const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocument } = require('@aws-sdk/lib-dynamodb');
/*
 Constants and environment variables that can be reused
 across Lambda invocations. AWS_REGION is a default variable
 inside of Lambda, so the default is largely for testing
*/
const CALLBACKTABLE = process.env.CALLBACKTABLE;
const REGION = process.env.AWS_REGION || 'ap-southeast-2';
// Client that is analaguous to the Python Boto3 Table Resource
const DOCCLIENT = DynamoDBDocument.from(new DynamoDBClient({ region: REGION }));

exports.set_handler = async (event, context) => {
  /*
    Lambda function to be used to check if a Callback request is already lodged
    for a given phone number (provided in E164 format), and if valid will store the
    values related to this in DDB so future reattempts can be stopped to ensure
    there are not multiple callbacks for a given number. This is done as AWS Connect
    has no standard duplicate prevention, meaning a user could enqueue a number
    of times for callbacks leading to a bad overall experience.

    Input:
      event: Standard Amazon Connect JSON event. Only 1 parameter is required

        callback_number - the callback phone number, in E164 format, which we are
          wanting to verify and store

    Output:
      result: JSON result of the invocation containing ths following:
        {
          "result": "SUCCESS" or "FAIL"
          "duplicate": boolean to show if the number already has a callback lodged
          "message": A small helper message regarding the outcome. For example could
            be 'CALLBACK_EXISTS', 'TABLE_UPDATED', or 'ERROR_ENCOUNTERED'
        }
  */
  console.log('Starting event with event', JSON.stringify(event));
  if (!(CALLBACKTABLE)) {
    throw new Error('Missing Required Environment Variable: CALLBACKTABLE');
  }

  // Default result object, since anything in the try block should return
  // something back to Connect
  const result = { 'result': 'FAIL', 'duplicate': false, 'message': '' };

  try {
    console.debug('Validating the provided Event');
    const channel = event.Details.ContactData.Channel;
    if (channel != 'VOICE') {
      // We can only handle Voice events. Anything else suggests the Callflow is
      // incorrectly designed
      throw new Error('Only Voice Channels can handle callbacks');
    }

    // Get the needed Param
    const params = await retrieveParams(event);
    if (!('callback_number' in params)) {
      throw new Error('\'callback_number\' parameter missing from event');
    }
    const callbackNumber = params.callback_number;

    console.info('Validation passed!');

    // DDB Specific Content from here
    const ddbKey = { 'callback_number': callbackNumber };

    const ddbParams = {
      TableName: CALLBACKTABLE,
      Key: ddbKey,
    };

    let response = await DOCCLIENT.get(ddbParams);
    if (response.Item !== undefined) {
      // Callback Exists
      console.debug('Callback exists for this number');
      result.message = 'CALLBACK_EXISTS';
      result.duplicate = true;
    } else {
      // No callback currently exists
      const ddbContent = {
        'original_request_id': event.Details.ContactData.ContactId,
        'created_at': await timestampWithOffset(0),
        // TTL set for a week
        'ttl': await timestampWithOffset(24 * 7),
      };
      const { updateExpression, expAttributesValues, expAttributeNames } =
        await expressionBuilder(ddbContent);
      ddbParams.UpdateExpression = updateExpression;
      ddbParams.ExpressionAttributeValues = expAttributesValues;
      ddbParams.ExpressionAttributeNames = expAttributeNames;
      ddbParams.ReturnValues = 'ALL_NEW';
      console.debug('Attempting to write to DDB table');
      // We could parse the response if we desired
      response = await DOCCLIENT.update(ddbParams);
      result.message = 'TABLE_UPDATED';
      result.result = 'SUCCESS';
    }
  } catch (exception) {
    console.error(exception);
    result.message = "ERROR_ENCOUNTERED"
  }
  console.info('Invocation Completed with result', result);
  return result;
};

exports.clear_handler = async (event, context) => {
  /*
    Lambda function to be used to clear a Callback from the DynamoDB Table.
    Because we want callbacks to proceed this will attempt to remove and
    otherwise ignore if their isn't a corresponding value in the table, as we
    do not want to halt in action processes. This does there should be a branch
    in your outbound flow that specifically is used by Callback Numbers, reached
    by either attribute branching or similar methods

    Input:
      event: Standard Amazon Connect JSON event. Only 1 parameter is required

        callback_number - the callback phone number, in E164 format, which we are
          wanting to verify and clear

    Output:
      result: JSON result of the invocation containing ths following:
        {
          "result": "SUCCESS" or "FAIL"
          "message": A small helper message regarding the outcome. For example could
            be 'NUMBER_CLEARED' or 'NO_ACTION'
        }
  */
  console.log('Starting event with event', JSON.stringify(event));
  if (!(CALLBACKTABLE)) {
    throw new Error('Missing Required Environment Variable: CALLBACKTABLE');
  }

  // Default result object, since anything in the try block should return
  // something back to Connect
  const result = { 'result': 'FAIL', 'message': '' };

  try {
    console.debug('Validating the provided Event');

    // Get the needed Param
    const params = await retrieveParams(event);
    if (!('callback_number' in params)) {
      throw new Error('\'callback_number\' parameter missing from event');
    }
    const callbackNumber = params.callback_number;

    console.info('Validation passed!');

    // DDB Specific Content from here
    const ddbKey = { 'callback_number': callbackNumber };

    const ddbParams = {
      TableName: CALLBACKTABLE,
      Key: ddbKey,
    };

    let response = await DOCCLIENT.get(ddbParams);
    if (response.Item !== undefined) {
      // Callback Exists
      console.debug('Callback exists for this number');
      response = await DOCCLIENT.delete(ddbParams);
      result.message = 'NUMBER_CLEARED';
      result.result = 'SUCCESS';
    } else {
      // No callback currently exists. This may indicate
      // an issue, but should block the callback from proceeding
      result.message = 'NO_ACTION';
      result.result = 'SUCCESS';
    }
  } catch (exception) {
    console.error(exception);
    result.message = "ERROR_ENCOUNTERED"
  }
  console.info('Invocation Completed with', result);
  return result;
};

/**
  * This function handles the creation of the update parameters for the DDB table.
  * It is done this way to both avoid issues around protected keywords that halt
  * completion, but also abstracts away the construction so the primary code block
  * can more focussed to provided just the expected values
  * @param {object} parameters The parameters we will build the update expression
  *   around
  * @return {object} The parsing result. This will have 3 components:
  *     'updateExpression': string - the update expression to execute against DDB
  *     'attributesValues': object - the dict of values to the corresponding variable mappings
  *     'expressionName': object - the dict of keys mapping attributes to the keys
 */
function expressionBuilder(parameters) {
  console.debug('At expressionBuilder()...');
  let uExp = 'set';
  const aVal = {};
  const eName = {};
  let varCounter = 1;
  return new Promise((resolve, reject) => {
    try {
      for (const [key, value] of Object.entries(parameters)) {
        const shortName = `#att${key}`;
        const varName = `:var${varCounter}`;
        eName[shortName] = key;
        // Below handles the comma
        if (varCounter == 1) {
          uExp = `${uExp} ${shortName} = ${varName}`;
        } else {
          uExp = `${uExp}, ${shortName} = ${varName}`;
        }
        aVal[varName] = value;
        varCounter++;
      }
      const returnObject = {
        'updateExpression': uExp,
        'expAttributesValues': aVal,
        'expAttributeNames': eName,
      };
      resolve(returnObject);
    } catch (exception) {
      console.error(exception);
      reject(exception);
    }
  });
}

/**
  * This method handles getting a epoch Timestamp, that can then be used in
  * DDB as required. The offset can then be used for functionality such as TTL
  * or other things like when actions should be taken
  * @param {integer} offset The offset time if any from current timestamp
  * @return {integer} The timestamp, offset by the provided value
 */
function timestampWithOffset(offset = 0) {
  console.debug('At timestampWithOffset()...');
  return new Promise((resolve, reject) => {
    try {
      const sinceEpoch = Math.round(Date.now() / 1000);
      // Offset it. Since we've shaved the milliseconds already we just
      // need it by seconds
      const timestamp = sinceEpoch + (offset * (60 * 60));
      resolve(timestamp);
    } catch (exception) {
      console.error(exception);
      reject(exception);
    }
  });
}

/**
  * This method handles retrieving the parameters as from an Amazon Connect
  * Event. This is split out as there is potential for enhanced logic or
  * further refinements
  * @param {object} event The Event as Lambda receieved it
  * @return {object} The specific parameters from the given event
 */
function retrieveParams(event) {
  console.debug('At retrieve_params()...');
  return new Promise((resolve, reject) => {
    try {
      // Enhancements can go here
      const details = event.Details;
      const params = details.Parameters;
      resolve(params);
    } catch (exception) {
      console.error(exception);
      reject(exception);
    }
  });
}
