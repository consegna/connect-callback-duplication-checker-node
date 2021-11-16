const fs = require('fs')
const { mockClient } = require('aws-sdk-client-mock');
const {
    DynamoDBDocumentClient, GetCommand,
    UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
process.env.CALLBACKTABLE = "fakeTable";
const handler = require('../index')

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
    ddbMock.reset();
});
/*
About Mocking: See 
https://m-radzikowski.github.io/aws-sdk-client-mock/#dynamodb-documentclient
*/
describe('Failure Tests for set_handler', () => {
    const OLD_ENV = process.env;
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    test('Run Set Handler No Empty Env Var', async () => {
        process.env.CALLBACKTABLE = null
        // Explicitly grab the handler here so the ENV var is UNSET
        const functionToTest = (require('../index')).set_handler;
        await expect(functionToTest({}, null))
            .rejects
            .toThrow('Missing Required Environment Variable: CALLBACKTABLE');
    });

    test('Run Set Handler No Parameters', async () => {
        let eventFile = fs.readFileSync('./events/bad_no_params.json');
        let event = JSON.parse(eventFile);
        let response = await handler.set_handler(event, null);
        expect(response.result).toEqual('FAIL');
        expect(response.message).toEqual('ERROR_ENCOUNTERED');
        expect(response.duplicate).toBeFalsy();
    });
});

describe('Success Tests for set_handler', () => {
    test('Run Set Handler Existing Entry', async () => {
        ddbMock.on(GetCommand, {
            TableName: 'fakeTable',
            Key: { 'callback_number': '+642101234567' },
        }).resolves({
            Item: {
                callback_number: "+642101234567",
                original_request_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                created_at: 1637029856,
                ttl: 1637634656
            }
        })
        let eventFile = fs.readFileSync('./events/good_all_content.json');
        let event = JSON.parse(eventFile);
        let response = await handler.set_handler(event, null);
        expect(response.result).toEqual('FAIL');
        expect(response.message).toEqual('CALLBACK_EXISTS');
        expect(response.duplicate).toBeTruthy();
    });

    test('Run Set Handler No Entry', async () => {
        ddbMock.on(GetCommand, {
            TableName: 'fakeTable',
            Key: { 'callback_number': '+642101234567' },
        }).resolves({
            Item: undefined
        })
        ddbMock.on(UpdateCommand, {
            TableName: 'fakeTable',
            Key: { 'callback_number': '+642101234567' },
            // There is more to this payload but this should illustrate
            // the behaviour
        }).resolves({
            callback_number: "+642101234567",
            original_request_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            created_at: 1637029856,
            ttl: 1637634656
        })
        let eventFile = fs.readFileSync('./events/good_all_content.json');
        let event = JSON.parse(eventFile);
        let response = await handler.set_handler(event, null);
        expect(response.result).toEqual('SUCCESS');
        expect(response.message).toEqual('TABLE_UPDATED');
        expect(response.duplicate).toBeFalsy();
    });
});