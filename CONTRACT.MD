# Contract for connect-callback-duplication-checker

This function requires the following parameters to be passed as parameters when invoking the lambda. When one of the parameters is absent it will default to the value in the `Default` column.
Remember that the output returned to Connect can only be a flat JSON object/Python dict, as Connect cannot access nested objects

## index.set_handler Handler Contract

### Variables

| Name            | Description                                                                 | Type     | Env/In/Out | Default          | Required |
| --------------- | --------------------------------------------------------------------------- | -------- | ---------- | ---------------- | :------: |
| CALLBACK_TABLE  | Name of the DDB Table that we are working against                           | `string` | Env        | N/A              |   yes    |
| AWS_REGION      | AWS Region                                                                  | `string` | Env        | "ap-southeast-2" |    no    |
| callback_number | The callback number (in E164 format) that we are checking/storing/clearing  | `string` | In         | N/A              |   yes    |
| result          | The outcome of the processing. `SUCCESS` for positive, otherwise `FAIL`     | `string` | Out        | N/A              |   yes    |
| message         | Any message related to the result. Can be used to make further decisions    | `string` | Out        | N/A              |   yes    |
| duplicate       | Value indiciating if the valuie provided is already stored in the datastore | `bool`   | Out        | N/A              |    no    |

| Source       | Operation | Value  | Target          | Required | Other |
| ------------ | --------- | ------ | --------------- | -------- | :---: |
| contact_flow | Invoke    | [dict] | app.set_handler | yes      | Entry |

### AWS Permissions

Note that everything under the OPTIONAL Header isn't stricly required, but is reocmmended as best practice. For example, your DDB Table should use a KMS key that you can control.

| Service  | Permissions     | Resource                                                                                |
| -------- | --------------- | --------------------------------------------------------------------------------------- |
| logs     | CreateLogGroup  | "arn:aws:logs:ap-southeast-2:{AWS-Acccount-ID}:\*"                                      |
|          | CreateLogStream |                                                                                         |
|          | PutLogEvents    | "arn:aws:logs:ap-southeast-2:{AWS-Acccount-ID}:log-group:/aws/lambda/{FunctionName}:\*" |
| dynamodb | GetItem         | "arn:aws:dynamodb:ap-southeast-2:{AWS-Acccount-ID}:table/{TableName}"                   |
|          | UpdateItem      | "arn:aws:dynamodb:ap-southeast-2:{AWS-Acccount-ID}:table/{TableName}"                   |
| -------- | --------------- | --------------------------------------------------------------------------------------- |
| OPTIONAL | --------------- | --------------------------------------------------------------------------------------- |
| kms      | Encrypt         | "arn:aws:dynamodb:ap-southeast-2:{AWS-Acccount-ID}:key/{KeyID}"                         |
|          | Encrypt         | "arn:aws:dynamodb:ap-southeast-2:{AWS-Acccount-ID}:key/{KeyID}"                         |

## index.clear_handler Handler Contract

### Variables

| Name            | Description                                                                | Type     | Env/In/Out | Default          | Required |
| --------------- | -------------------------------------------------------------------------- | -------- | ---------- | ---------------- | :------: |
| CALLBACK_TABLE  | Name of the DDB Table that we are working against                          | `string` | Env        | N/A              |   yes    |
| AWS_REGION      | AWS Region                                                                 | `string` | Env        | "ap-southeast-2" |    no    |
| callback_number | The callback number (in E164 format) that we are checking/storing/clearing | `string` | In         | N/A              |   yes    |
| result          | The outcome of the processing. `SUCCESS` for positive, otherwise `FAIL`    | `string` | Out        | N/A              |   yes    |
| message         | Any message related to the result. Can be used to make further decisions   | `string` | Out        | N/A              |   yes    |

| Source       | Operation | Value  | Target            | Required | Other |
| ------------ | --------- | ------ | ----------------- | -------- | :---: |
| contact_flow | Invoke    | [dict] | app.clear_handler | yes      | Entry |

### AWS Permissions

Note that everything under the OPTIONAL Header isn't stricly required, but is reocmmended as best practice. For example, your DDB Table should use a KMS key that you can control.

| Service  | Permissions     | Resource                                                                                |
| -------- | --------------- | --------------------------------------------------------------------------------------- |
| logs     | CreateLogGroup  | "arn:aws:logs:ap-southeast-2:{AWS-Acccount-ID}:\*"                                      |
|          | CreateLogStream |                                                                                         |
|          | PutLogEvents    | "arn:aws:logs:ap-southeast-2:{AWS-Acccount-ID}:log-group:/aws/lambda/{FunctionName}:\*" |
| dynamodb | GetItem         | "arn:aws:dynamodb:ap-southeast-2:{AWS-Acccount-ID}:table/{TableName}"                   |
|          | DeleteItem      | "arn:aws:dynamodb:ap-southeast-2:{AWS-Acccount-ID}:table/{TableName}"                   |
| -------- | --------------- | --------------------------------------------------------------------------------------- |
| OPTIONAL | --------------- | --------------------------------------------------------------------------------------- |
| kms      | Encrypt         | "arn:aws:dynamodb:ap-southeast-2:{AWS-Acccount-ID}:key/{KeyID}"                         |
|          | Encrypt         | "arn:aws:dynamodb:ap-southeast-2:{AWS-Acccount-ID}:key/{KeyID}"                         |

## DDB Table

The functions require a a table to consistently access to manipulate and use for a datastore. The structure is as below. Note that there may be other attributes, but since DynamoDB is NoSQL these don't require specific upfront declaration

| Attribute       | Type     | Schema        |
| --------------- | -------- | ------------- |
| callback_number | `string` | Partition Key |
| ttl             | `number` | TTL           |
