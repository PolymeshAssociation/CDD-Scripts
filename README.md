# CDD Scripts

This project provides sample, non-production, scripts for common CDD provider use-cases.

It uses:  
- Polymesh Blockchain
- Polymesh SDK
- PUIS
- Confidential Library

Note - this project does not currently make use of the PUIS Audit System.

## Use Cases

There are three common use-cases for CDD providers.

In all cases, the project assumes:  
- CDD provider has verified user matches PII data (via documentation checks)  
- CDD provider has verified that user owns Primary Key (via random signing challenge)

In all cases, the CDD provider must supply the users:  
- Primary Key
- Hashed PII data 

### New user

In this scenario, the user has not interacted with Polymesh previously.

They have no existing identity on Polymesh, nor are they registered in the PUIS.

If the users PII data is unique within the PUIS, a new identity is created, the PII data is registered to the PUIS, and a CDD claim is attached to the users new identity.

If the users PII data is not unique within the PUIS, a redirect response is returned, indicating the user must go to another CDD provider.

```
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
async function new_user(primary_key, pii_hash)
```

### Existing user with an existing identity

In this scenario, the user has already been onboarded to Polymesh and is asking for a new CDD claim on an existing identity.

In this case, the CDD provider must also provide the users unique id and the DID against which the new CDD claim will be written, both supplied by the user.

```
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
async function existing_user_with_existing_identity(primary_key, pii_hash, v4_unique_id, did)
```

### Existing user with an new identity

In this scenario, the user has already been onboarded to Polymesh and is asking for a new identity to be created with a new CDD claim.

In this case, the CDD provider must also provide the users unique id as supplied by the user.

```
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
async function existing_user_with_new_identity(primary_key, pii_hash, v4_unique_id)
```

## Sample Output

A sample script can be executed using:  
```
yarn
node ./index.js
```

The output should look similar to:  
```
Creating New User: 
 {
  "primary_key": "5GUKzjVpS7cLgKPnPskmq6xhCAx4YWqo9DgFQ8DFdvabMn3f",
  "pii_hash": [
    {
      "check_name": "BaseIndividual",
      "pii_payloads": [
        {
          "payload_name": "FirstName",
          "payload_value": "a94967581376bccb35cc923ea136892c734782b028310d176c616998e56c4b0f743a15364f4ad371cb9c22fd4a0a16d77e338eab396fc87fcc83e442b08d976d"
        },
        {
          "payload_name": "LastName",
          "payload_value": "6be670010f83dbe40fec70305830d133a84879fe776890eee94f6101ce4b2e58c4186b963000bc9fc82e4d9636804286bf7d0fe327e7fdb9ff2ca5923e7627f1"
        },
        {
          "payload_name": "BirthDate",
          "payload_value": "af8709cc9d99fe82c7d0d5b81775e4397e909b7cdf39c246152fafc991670cda4491d7e03befd4e151f2b5a1bc8748c5f5a4ad67edfd34073e09edbccd77bbaa"
        },
        {
          "payload_name": "CountryAlpha2",
          "payload_value": "CA"
        }
      ]
    }
  ]
}
****Polymesh***** Getting SDK api
****Polymesh***** Checking Primary Key is unused
Primary Key is unused
****PUIS***** Getting Swagger Client
****PUIS***** Checking if PII hash exists
PII hash does not exist
****PUIS***** Generating uID
uID Generated:  7b45a874-a106-4057-b82e-f47cb42ccad7
****Polymesh***** Creating DID
DID Created:  0xe68edc3585d89142240bca208e51b774f5400570119b9d3120f2f3b567b37095
****Confidential Identity Library***** Deriving CDD_ID
CDD_ID Derived:  0x9444ce1ca187d60c77d31329160a236ecf7a1a65deba1c32a750baeb676fb673
****Polymesh***** Writing CDD Attestation
CDD Attestation Written
New User:  0xe68edc3585d89142240bca208e51b774f5400570119b9d3120f2f3b567b37095 7b45a874-a106-4057-b82e-f47cb42ccad7
```

```
Redirecting New User: 
 {
  "primary_key": "5FpoC8Nsoy2Ur3vHobch4do9igSCADNdUBwStJoYXN6Eib1c",
  "pii_hash": [
    {
      "check_name": "BaseIndividual",
      "pii_payloads": [
        {
          "payload_name": "FirstName",
          "payload_value": "a94967581376bccb35cc923ea136892c734782b028310d176c616998e56c4b0f743a15364f4ad371cb9c22fd4a0a16d77e338eab396fc87fcc83e442b08d976d"
        },
        {
          "payload_name": "LastName",
          "payload_value": "6be670010f83dbe40fec70305830d133a84879fe776890eee94f6101ce4b2e58c4186b963000bc9fc82e4d9636804286bf7d0fe327e7fdb9ff2ca5923e7627f1"
        },
        {
          "payload_name": "BirthDate",
          "payload_value": "af8709cc9d99fe82c7d0d5b81775e4397e909b7cdf39c246152fafc991670cda4491d7e03befd4e151f2b5a1bc8748c5f5a4ad67edfd34073e09edbccd77bbaa"
        },
        {
          "payload_name": "CountryAlpha2",
          "payload_value": "CA"
        }
      ]
    }
  ]
}
****Polymesh***** Getting SDK api
****Polymesh***** Checking Primary Key is unused
Primary Key is unused
****PUIS***** Getting Swagger Client
****PUIS***** Checking if PII hash exists
Redirected User:  Polymath https://polymath.network/
```

```
Creating Second Claim On Existing DID: 
 {
  "primary_key": "5GUKzjVpS7cLgKPnPskmq6xhCAx4YWqo9DgFQ8DFdvabMn3f",
  "pii_hash": [
    {
      "check_name": "BaseIndividual",
      "pii_payloads": [
        {
          "payload_name": "FirstName",
          "payload_value": "a94967581376bccb35cc923ea136892c734782b028310d176c616998e56c4b0f743a15364f4ad371cb9c22fd4a0a16d77e338eab396fc87fcc83e442b08d976d"
        },
        {
          "payload_name": "LastName",
          "payload_value": "6be670010f83dbe40fec70305830d133a84879fe776890eee94f6101ce4b2e58c4186b963000bc9fc82e4d9636804286bf7d0fe327e7fdb9ff2ca5923e7627f1"
        },
        {
          "payload_name": "BirthDate",
          "payload_value": "af8709cc9d99fe82c7d0d5b81775e4397e909b7cdf39c246152fafc991670cda4491d7e03befd4e151f2b5a1bc8748c5f5a4ad67edfd34073e09edbccd77bbaa"
        },
        {
          "payload_name": "CountryAlpha2",
          "payload_value": "CA"
        }
      ]
    }
  ],
  "uuid": "7b45a874-a106-4057-b82e-f47cb42ccad7",
  "did": "0xe68edc3585d89142240bca208e51b774f5400570119b9d3120f2f3b567b37095"
}
****Polymesh***** Getting SDK api
****Polymesh***** Checking Primary Key matches DID
Primary Key matches DID
****PUIS***** Getting Swagger Client
****PUIS***** Checking if PII hash matches unique id
PII hash matches unique id
****Confidential Identity Library***** Deriving CDD_ID
CDD_ID Derived:  0x9444ce1ca187d60c77d31329160a236ecf7a1a65deba1c32a750baeb676fb673
****Polymesh***** Writing CDD Attestation
CDD Attestation Written
Existing User, Existing Identity:  0xe68edc3585d89142240bca208e51b774f5400570119b9d3120f2f3b567b37095 7b45a874-a106-4057-b82e-f47cb42ccad7

Creating Second Claim On New DID: 
 {
  "primary_key": "5FpoC8Nsoy2Ur3vHobch4do9igSCADNdUBwStJoYXN6Eib1c",
  "pii_hash": [
    {
      "check_name": "BaseIndividual",
      "pii_payloads": [
        {
          "payload_name": "FirstName",
          "payload_value": "a94967581376bccb35cc923ea136892c734782b028310d176c616998e56c4b0f743a15364f4ad371cb9c22fd4a0a16d77e338eab396fc87fcc83e442b08d976d"
        },
        {
          "payload_name": "LastName",
          "payload_value": "6be670010f83dbe40fec70305830d133a84879fe776890eee94f6101ce4b2e58c4186b963000bc9fc82e4d9636804286bf7d0fe327e7fdb9ff2ca5923e7627f1"
        },
        {
          "payload_name": "BirthDate",
          "payload_value": "af8709cc9d99fe82c7d0d5b81775e4397e909b7cdf39c246152fafc991670cda4491d7e03befd4e151f2b5a1bc8748c5f5a4ad67edfd34073e09edbccd77bbaa"
        },
        {
          "payload_name": "CountryAlpha2",
          "payload_value": "CA"
        }
      ]
    }
  ],
  "uuid": "7b45a874-a106-4057-b82e-f47cb42ccad7"
}
****Polymesh***** Getting SDK api
****Polymesh***** Checking Primary Key is unused
****PUIS***** Getting Swagger Client
****PUIS***** Checking if PII hash matches unique id
PII hash matches unique id
****Polymesh***** Creating DID
DID Created:  0x8b74d850dcf9676d49d3f514603d4fd15b7d794afe75ed01eaf60277bcc6ec3c
****Confidential Identity Library***** Deriving CDD_ID
CDD_ID Derived:  0xe459a935fc228195f16e381829d08bf9e42f8700afa51f4e18ee31b24612e643
****Polymesh***** Writing CDD Attestation
CDD Attestation Written
Existing User, New Identity:  0xe68edc3585d89142240bca208e51b774f5400570119b9d3120f2f3b567b37095 7b45a874-a106-4057-b82e-f47cb42ccad7
```