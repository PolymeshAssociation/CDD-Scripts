const { Polymesh } = require('@polymathnetwork/polymesh-sdk');
const { ClaimType, ScopeType } = require('@polymathnetwork/polymesh-sdk/types');
const { encodeAddress } = require('@polkadot/keyring');
const SwaggerClient = require('swagger-client');
const BigNumber = require('bignumber.js');
const fs = require('fs');
const path = require('path');
const sha512 = require('js-sha512');
const crypto = require('crypto');
const confidential_identity = require('./pkg/confidential_identity_wasm');
const { u8aToHex, hexToU8a, stringToU8a } = require('@polkadot/util');

// Mock CDD Process
// NB - does not implement PUIS Audit Process

// Assumptions:
//  CDD provider has verified user matches pii_hash data (via documentation checks)
//  CDD provider has verified that user owns primary_key (via random signing challenge)

// New User - no existing uID, new identity
//
// Behaviour:
//  If primary_key is already in use, return failure
//  If pii_hash exists, should return redirect
//  Otherwise generates unique id, creates new identity and attaches CDD claim
//
// Assumptions:
//  CDD provider has verified user matches pii_hash data (via documentation checks)
//  CDD provider has verified that user owns primary_key (via random signing challenge)
//
// Returns:
//  1st value indicates whether operation was successful, or whether a redirect is needed
//  [true, did, v4_uuid] or [false, redirect_provider_name, redirect_provider_url]
//  otherwise throws error
async function new_user(primary_key, pii_hash) {

    // console.log("****Input Data****");
    // console.log(JSON.stringify({primary_key: primary_key, pii_hash: pii_hash}, null, 2));

    console.log('****Polymesh***** Getting SDK api')
    const polymesh = await getPolymesh();    

    console.log('****Polymesh***** Checking Primary Key is unused')
    let existing_identity = await getIdentityFromAccount(polymesh, primary_key);
    if (existing_identity != undefined) {
        throw new Error("PrimaryKeyInUse");
    }
    console.log("Primary Key is unused");

    console.log('****PUIS***** Getting Swagger Client');
    let puis = await getPUIS();

    // Check if pii_hash already exists, and we need to redirect
    console.log('****PUIS***** Checking if PII hash exists');
    let [redirect, provider_name, provider_url] = await piiExists(puis, pii_hash);
    if (redirect) {
        return [false, provider_name, provider_url];
    }
    console.log('PII hash does not exist');

    console.log('****PUIS***** Generating uID');
    let v4_unique_id = await getUid(puis, pii_hash);
    console.log("uID Generated: ", v4_unique_id);
    // Change uID from uuid v4 format to hex format
    let unique_id = "0x" + (v4_unique_id.replace(/-/g, ''));

    console.log('****Polymesh***** Creating DID')
    let identity = await createIdentity(polymesh, primary_key);
    console.log("DID Created: ", identity.did);

    console.log('****Confidential Identity Library***** Deriving CDD_ID');
    let cdd_id = confidential_identity.process_create_cdd_id(
        JSON.stringify({
            investor_did: Array.from(hexToU8a(identity.did)),
            investor_unique_id: Array.from(hexToU8a(unique_id))
        })
    );
    cdd_id = "0x" + createHexString(JSON.parse(cdd_id).cdd_id);
    console.log("CDD_ID Derived: ", cdd_id)

    console.log('****Polymesh***** Writing CDD Attestation')
    await writeCddClaim(polymesh, identity.did, cdd_id)
    console.log('CDD Attestation Written')

    return [true, identity.did, unique_id, cdd_id];

}

// Existing User - existing uID, existing identity
//
// Behaviour:
//  If pii_hash does not match v4_unique_id, return failure
//  If did does not exist on Polymesh, return failure
//  If v4_unique_id does not match existing valid CDD claims on did, return failure (TODO)
//  Otherwise attaches CDD claim
//
// Assumptions:
//  CDD provider has verified user matches pii_hash data (via documentation checks)
//  CDD provider has verified that user owns primary_key (via random signing challenge)
//
// Returns:
//  true if operation was successful, otherwise throws error
async function existing_user_with_existing_identity(primary_key, pii_hash, v4_unique_id, did) {

    // console.log("****Input Data****");
    // console.log(JSON.stringify({pii_hash: pii_hash, unique_id: v4_unique_id, did: did}, null, 2));

    console.log('****Polymesh***** Getting SDK api')
    const polymesh = await getPolymesh();

    console.log('****Polymesh***** Checking Primary Key matches DID')
    let existing_identity = await getIdentityFromAccount(polymesh, primary_key);
    if (existing_identity == undefined || existing_identity.did != did) {
        throw Error("PrimaryKeyAndDidMismatch")
    }
    console.log("Primary Key matches DID");

    console.log('****PUIS***** Getting Swagger Client');
    let puis = await getPUIS();

    // Check that verified pii data matches user provided unique id
    console.log('****PUIS***** Checking if PII hash matches unique id');
    let [piiMatch, provider_name, provider_url] = await piiHashMatchesUid(puis, pii_hash, v4_unique_id);
    if (!piiMatch) {
        throw Error("PiiAndUniqueIdMismatch")
    }
    console.log('PII hash matches unique id');
    
    let unique_id = "0x" + (v4_unique_id.replace(/-/g, ''));

    console.log('****Confidential Identity Library***** Deriving CDD_ID');
    let cdd_id = confidential_identity.process_create_cdd_id(
        JSON.stringify({
            investor_did: Array.from(hexToU8a(did)),
            investor_unique_id: Array.from(hexToU8a(unique_id))
        })
    );
    cdd_id = "0x" + createHexString(JSON.parse(cdd_id).cdd_id);
    console.log("CDD_ID Derived: ", cdd_id) 

    console.log('****Polymesh***** Writing CDD Attestation')
    await writeCddClaim(polymesh, did, cdd_id)
    console.log('CDD Attestation Written');

    return true;

}

// Existing User - existing uID, new identity
//
// Behaviour:
//  If primary_key is already in use, return failure
//  If pii_hash does not match v4_unique_id, return failure
//  Otherwise creates new identity and attaches CDD claim
//
// Assumptions:
//  CDD provider has verified user matches pii_hash data (via documentation checks)
//  CDD provider has verified that user owns primary_key (via random signing challenge)
//
// Returns:
//  [true, did] if operation is successful, otherwise throws error
async function existing_user_with_new_identity(primary_key, pii_hash, v4_unique_id) {

    // console.log("****Input Data****");
    // console.log(JSON.stringify({primary_key: primary_key, pii_hash: pii_hash, unique_id: v4_unique_id}, null, 2));

    console.log('****Polymesh***** Getting SDK api')
    const polymesh = await getPolymesh();    

    console.log('****Polymesh***** Checking Primary Key is unused')
    let existing_identity = await getIdentityFromAccount(polymesh, primary_key);
    if (existing_identity != undefined) {
        throw new Error("PrimaryKeyInUse");
    }

    console.log('****PUIS***** Getting Swagger Client');
    let puis = await getPUIS();

    // Check that verified pii data matches user provided unique id
    console.log('****PUIS***** Checking if PII hash matches unique id');
    let [piiMatch, provider_name, provider_url] = await piiHashMatchesUid(puis, pii_hash, v4_unique_id);
    if (!piiMatch) {
        throw new Error("PiiAndUniqueIdMismatch");
    }
    console.log('PII hash matches unique id');

    let unique_id = "0x" + (v4_unique_id.replace(/-/g, ''));

    console.log('****Polymesh***** Creating DID')
    let identity = await createIdentity(polymesh, primary_key);
    console.log("DID Created: ", identity.did);

    console.log('****Confidential Identity Library***** Deriving CDD_ID');
    let cdd_id = confidential_identity.process_create_cdd_id(
        JSON.stringify({
            investor_did: Array.from(hexToU8a(identity.did)),
            investor_unique_id: Array.from(hexToU8a(unique_id))
        })
    );
    cdd_id = "0x" + createHexString(JSON.parse(cdd_id).cdd_id);
    console.log("CDD_ID Derived: ", cdd_id)

    console.log('****Polymesh***** Writing CDD Attestation')
    await writeCddClaim(polymesh, identity.did, cdd_id)
    console.log('CDD Attestation Written');

    return [true, identity.did, cdd_id]

}

async function getPolymesh() {
    const api = await Polymesh.connect({
        nodeUrl: 'ws://127.0.0.1:9944',
        accountUri: '//Alice',
    });
    return api;
}

async function getPolymeshCharlie() {
    const api = await Polymesh.connect({
        nodeUrl: 'ws://127.0.0.1:9944',
        accountUri: '//Charlie',
    });
    return api;
}

async function getPUIS() {
    let swagger_file = "./swagger.json";
    var url = path.join(__dirname, swagger_file);
    let swagger_spec = JSON.parse(fs.readFileSync(url));

    return new SwaggerClient({
        spec: swagger_spec,
        authorizations: { basicAuth: { username: '513dec7807e371e6aba311583521384ec9fe7e137cf6be1e01e6ca542746aac6', password: 'anypass' } }
    });
}

async function piiHashMatchesUid(puis, pii_hash, uId) {
    let puis_response = await puis.apis.identity.checkuID({checks: {checks: pii_hash, uID: uId}});
    let match = puis_response.body[0];
    if ("check_name" in match) {
        return [true, match.CheckProvider.provider_name, match.CheckProvider.provider_url];
    } else {
        return [false, "", ""];
    }
}

async function piiExists(puis, pii_hash) {
    let puis_response = await puis.apis.identity.searchuID({body: pii_hash});
    let match = puis_response.body[0];
    if ("check_name" in match) {
        return [true, match.CheckProvider.provider_name, match.CheckProvider.provider_url];
    } else {
        return [false, "", ""];
    }
}

async function getUid(puis, payload) {
    let puis_response = await puis.apis.identity.createuID({IdentityChecks: payload});
    let uId = puis_response.body.uID;        
    return uId;
}

async function createIdentity(polymesh, target_account) {
    let transactionQ = await polymesh.registerIdentity({
        targetAccount: target_account
    });
    const identity = await transactionQ.run();
    return identity;
}

async function getIdentityFromAccount(polymesh, target_account) {
    let account = await polymesh.getAccount({
        address: target_account
    });
    let identity = await account.getIdentity();
    return identity;
}

async function writeCddClaim(polymesh, did, cdd_id) {
    let claims = polymesh.claims;
    let transactionQ = await claims.addClaims(
        {claims: [
            {
                target: did,
                claim: {
                    type: ClaimType.CustomerDueDiligence,
                    id: cdd_id,
                },
            },
        ]}
    )
    await transactionQ.run();
}

async function transferPolyX(polymesh, to, amount) {
    let transactionQ = await polymesh.transferPolyX({
        to: to,
        amount: amount
    });
    await transactionQ.run();
}

//NB - this is not needed by CDD providers, but uses CDD claims (specifically the CDD_ID)
async function writeInvestorUniquenessClaim(polymesh, did, unique_id, scope_did, cdd_id) {
    console.log('****Confidential Identity Library***** Generating InvestorUniquenessProof');
    let iu_proof = confidential_identity.process_create_claim_proof(
        JSON.stringify({
            investor_did: Array.from(hexToU8a(did)),
            investor_unique_id: Array.from(hexToU8a(unique_id))
        }),
        JSON.stringify({
            scope_did: Array.from(hexToU8a(scope_did)),
            investor_unique_id: Array.from(hexToU8a(unique_id))
        })
    );
    let proof = "0x" + createHexString(JSON.parse(iu_proof).proof);
    let scope_id = "0x" + createHexString(JSON.parse(iu_proof).scope_id);
    console.log('****Polymesh***** Writing InvestorUniqueness Claim');
    let claims = polymesh.claims;
    let transactionQ = await claims.addInvestorUniquenessClaim(
        {
            cddId: cdd_id,
            proof: proof,
            scope: {type: ScopeType.Ticker, value: scope_did},
            scopeId: scope_id
        }
    )
    await transactionQ.run();
}

// Create dummy inputs as needed

function createDummyPiiHash() {
    return [
        {
          "check_name": "BaseIndividual",
          "pii_payloads": [
            {
                "payload_name": "FirstName",
                "payload_value": sha512(Math.random().toString(36).substring(7))
            },
            {
                "payload_name": "LastName",
                "payload_value": sha512(Math.random().toString(36).substring(7))
            },
            {
                "payload_name": "BirthDate",
                "payload_value": sha512(Math.random().toString(36).substring(7))
            },
            {
                "payload_name": "CountryAlpha2",
                "payload_value": "CA"
            }
          ]
        }
    ];
}

function createFixedPiiHash() {
    return [
        {
          "check_name": "BaseIndividual",
          "pii_payloads": [
            {
                "payload_name": "FirstName",
                "payload_value": sha512("Adam1")
            },
            {
                "payload_name": "LastName",
                "payload_value": sha512("Dossa")
            },
            {
                "payload_name": "BirthDate",
                "payload_value": sha512("19/11/1979")
            },
            {
                "payload_name": "CountryAlpha2",
                "payload_value": "UK"
            }
          ]
        }
    ];
}

function createDummyAccount() {
    const random_address = '0x' + crypto.randomBytes(32).toString('hex');
    return encodeAddress(random_address, 42);
}

// Utility functions

function parseHexString(str) { 
    var result = [];
    while (str.length >= 2) { 
        result.push(parseInt(str.substring(0, 2), 16));
        str = str.substring(2, str.length);
    }

    return result;
}

function createHexString(arr) {
    var result = "";
    for (i in arr) {
        var str = arr[i].toString(16);
        str = str.length == 0 ? "00" :
              str.length == 1 ? "0" + str : 
              str.length == 2 ? str :
              str.substring(str.length-2, str.length);
        result += str;
    }
    return result;
}

async function main() {
    let primary_key = createDummyAccount();
    let pii_hash = createDummyPiiHash();
    let uuid;
    let did;
    let result;

    // // Onboard a new user
    // console.log("Creating New User: \n", JSON.stringify({primary_key: primary_key, pii_hash: pii_hash}, null, 2));
    // try {
    //     [result, did, uuid, cdd_id] = await new_user(primary_key, pii_hash);
    //     if (!result) {
    //         throw new Error("NewUserUnexpectedError");
    //     }
    //     console.log("New User: ", did, uuid, cdd_id);
    // } catch (err) {
    //     console.log("Unexpected Error: ", err);
    //     return;
    // }

    // Create a new CDD claim for Charlie
    // This allows us to then generate an investor uniqueness claim (since only the identity can write IU claims for itself)
    let charles_pii_hash = createDummyPiiHash();
    const polymesh_charles = await getPolymeshCharlie();
    const polymesh_alice = await getPolymesh();
    let charles_primary_key = polymesh_charles.getAccount().key;
    console.log("Creating InvestorUniqueness claim for Alice: \n", JSON.stringify({primary_key: charles_primary_key, pii_hash: charles_pii_hash}, null, 2));
    try {
        [result, did, uuid, cdd_id] = await new_user(charles_primary_key, charles_pii_hash);
        if (!result) {
            throw new Error("NewUserUnexpectedError");
        }
        console.log("Charlie: ", did, uuid, cdd_id);
        await transferPolyX(polymesh_alice, charles_primary_key, new BigNumber(1000));
        // NB - this step is not performed by CDD providers - for reference only
        // Write a InvestorUniqueness claim for new user
        let scope_did = "0x41434d450000000000000000"; //ACME
        await writeInvestorUniquenessClaim(polymesh_charles, did, uuid, scope_did, cdd_id);
    } catch (err) {
        console.log("Unexpected Error: ", err);
        return;
    }

    // let new_primary_key = createDummyAccount();
    // console.log("Redirecting New User: \n", JSON.stringify({primary_key: new_primary_key, pii_hash: pii_hash}, null, 2));
    // try {
    //     let provider_name;
    //     let provider_url;
    //     [result, provider_name, provider_url] = await new_user(new_primary_key, pii_hash);
    //     if (result) {
    //         throw new Error("RedirectedUserUnexpectedError");
    //     }
    //     console.log("Redirected User: ", provider_name, provider_url);
    // } catch (err) {
    //     console.log("Unexpected Error: ", err);
    //     return;
    // }

    // // Create second CDD claim on existing identity
    // console.log("Creating Second Claim On Existing DID: \n", JSON.stringify({primary_key: primary_key, pii_hash: pii_hash, uuid: uuid, did: did}, null, 2));
    // try {
    //     result = await existing_user_with_existing_identity(primary_key, pii_hash, uuid, did);
    //     if (!result) {
    //         throw new Error("ExistingUserExistingIdentityUnexpectedError");
    //     }
    //     console.log("Existing User, Existing Identity: ", did, uuid)
    // } catch (err) {
    //     console.log("Unexpected Error: ", err);
    //     return;
    // }

    // // Create second CDD claim on new identity
    // let new_did;
    // console.log("Creating Second Claim On New DID: \n", JSON.stringify({primary_key: new_primary_key, pii_hash: pii_hash, uuid: uuid}, null, 2));
    // try {
    //     [result, new_did] = await existing_user_with_new_identity(new_primary_key, pii_hash, uuid);
    //     if (!result) {
    //         throw new Error("ExistingUserNewIdentityUnexpectedError");
    //     }
    //     console.log("Existing User, New Identity: ", did, uuid)
    // } catch (err) {
    //     console.log("Unexpected Error: ", err);
    //     return;
    // }
}

main();