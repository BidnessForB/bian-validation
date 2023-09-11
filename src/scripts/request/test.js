/*
NOTE: This code is stored in GitHub:
https://github.com/BidnessForB/bian-validation/blob/main/src/scripts/request/test.js

*/
debugger;
const Request = require('postman-collection').Request;
const config = JSON.parse(pm.collectionVariables.get('ct_config'));
const yaml =  pm.collectionVariables.get('CodeLibrary_js_yaml');
(new Function(yaml))();

var api = 'Payment Initiation'; //need to make this dynamic
var path = pm.collectionVariables.get("ct_runtime_schemaPath");  //need to make this dynamic
var method = pm.request.method.toLowerCase(); //Set dynamically

// Pull variables needed to pull the OpenAPI
// TODO: this should all be dynamic somehow, maybe by tracing request path
var postman_api_key = pm.environment.get("Postman_APIKey");
var api_id = config.api.id
var api_version_id = config.api.versionID;
var schema_id = config.api.schemaID;

//console.log("API ID: " + api_id + " API VERSION ID: " + api_version_id + " SCHEMA ID: " + schema_id);

// Pull the OpenAPI from the Postman API
// We're just after a schema here and it's not going to change, should we just go straight to BIAN?
var api_url = 'https://api.getpostman.com/apis/' + api_id + '/versions/' + api_version_id + '/schemas/' + schema_id;

function requireAll (schema) {
  if(status != 200) {
      return schema;
  }
  var newSchema = {};
  newSchema.type = schema.type;
  newSchema.properties = schema.properties;
  newSchema.required = Object.keys(schema.properties);
  newSchema.additionalProperties = false;
  if(status == 200) {
      newSchema.properties.PaymentInitiationTransaction.required = Object.keys(schema.properties.PaymentInitiationTransaction.properties);
      newSchema.properties.PaymentInitiationTransaction.additionalProperties = false;
    }
  return newSchema
};

function validate  (data, schema) {
  var Ajv = require('ajv');
  ajv = new Ajv({logger: console});
  if(config.setAllPropertiesRequired)
    schema = requireAll(schema);
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return valid;
};

function resolveSchemaRef (apischema, ref) {
//var refElems = paramsRef.split('\/');
var refElems = ref.split('\/');
var elem = apischema;
if(refElems[0] === '#') {
    refElems.splice(0,1);
}
refElems.forEach(pathElem => {
    elem = elem[pathElem];
});
return elem;
}

function getRequestSchema (apischema, requestPath, method) {
  var schemaData = {};
    var ref;
    contentType = 'application/json'
    schemaData.schema =   apischema.paths[requestPath][method];
    if(schemaData.schema.requestBody === undefined) {
        //no Request Body
        schemaData.schema = null;
        schemaData.ref = 'No Ref';
        return schemaData;
    }
    if(schemaData.schema.requestBody.$ref !== undefined) {
        schemaData.bodySchema = resolveSchemaRef(apischema, schemaData.schema.requestBody.$ref);
        ref = schemaData.bodySchema.content[contentType].schema.$ref;
        schemaData.ref = ref.split('\/')[ref.split('\/').length - 1];
        schemaData.bodySchema = resolveSchemaRef(apischema, schemaData.bodySchema.content[contentType].schema.$ref);
    }

    
    
    
    return schemaData;
}

function getResponseSchema (apischema, requestPath, method, status, contentType) {
  contentType = 'application/json'; //hard coded for now till we figure out how to get it out of the headers.
  var respSchema = apischema.paths[requestPath][method].responses[status];
  var respObj;
  var schemaData = {};
  var ref;

  if(respSchema === undefined || respSchema === null) {
      return null;
  }
  if(respSchema.$ref !== undefined) {
      respObj = resolveSchemaRef(apischema, respSchema.$ref);
      if(respObj.content[contentType].schema.$ref !== undefined) {
          respSchema = resolveSchemaRef(apischema, respObj.content[contentType].schema.$ref);
          schemaData.schema = respSchema;
          ref = respObj.content[contentType].schema.$ref;
          schemaData.ref = ref.split('\/')[ref.split('\/').length - 1]
      }
  }
  else {
    schemaData.schema = respSchema.content[contentType].schema;
    schemaData.ref = 'Native (no ref)';
  }
  return schemaData;
//return new Object();

}


function getSubSchemaYaml (schemapath, method, schemaYaml, type) {
  
  var schemaJson = jsyaml.load(schemaYaml);
  return getSubSchemaJson(schemapath, method, schemaJson, type);
};

function validatePropertyList(apischema, reqSchema, request) {
  var paramSchema;
  
  var curSchemaParam;
  var validationResults = [];
  var curValidationMessage
  var reqVarsToSearch;
  
  
  for(i = 0 ; i < reqSchema.parameters.length; i++)
  {
      curSchemaParam = reqSchema.parameters[i];
      //is it a ref?
      if('$ref' in curSchemaParam) {
          //resolve the ref
          curSchemaParam = resolveSchemaRef(apischema, curSchemaParam.$ref);
      }
      switch (curSchemaParam.in) {
          case 'path':
              {
                  return validationResults; // Can't validate path variables ATM.  the pm.request object available in the sandbox has the resolve values in the URL, and no values in the `variables` property list.
                  //reqVarsToSearch = request.url.variables.toObject(null,null,null,null);
                  break;
              }
          case 'query':
              {
                  reqVarsToSearch = request.url.query.toObject(null,null,null,null);
                  break;
              }
          case 'header':
              {
                  reqVarsToSearch = request.headers.toObject(null,null,null,null);
                  break;
              }
          case 'cookie':
              {
                  //Not implemented
                  return validationResults
              }
          
      }
      //Path or query variable?
      
      curValidationMessage = new Object();

      //If the variable is required and missing, create a validation message and add it to the results array
      if(curSchemaParam.required && (reqVarsToSearch[curSchemaParam.name] === null || reqVarsToSearch[curSchemaParam.name] === undefined )){
          curValidationMessage.param = curSchemaParam.name;
          curValidationMessage.message = "Required " + curSchemaParam.in.toUpperCase() + " parameter [" + curSchemaParam.name +"] missing";
          validationResults.push(curValidationMessage);
      }
      //If the variable is present and there is a type defined in the schema....
      else if(curSchemaParam.schema.type !== undefined) 
      {
          //If the type is integer, verify that the value in the request is an integer.  
          if((curSchemaParam.schema.type === 'integer') && Number.isNaN(parseInt(reqVarsToSearch[curSchemaParam.name]))) {
              curValidationMessage.param = curSchemaParam.name;
              curValidationMessage.message = curSchemaParam.in.toUpperCase() + " param [" + curSchemaParam.name +"] value [" + reqVarsToSearch[curSchemaParam.name] + "] is invalid for schema type: " + curSchemaParam.schema.type;
              validationResults.push(curValidationMessage);
          }
          delete reqVarsToSearch[curSchemaParam.name];
      }

  }
  

  return validationResults;
  
}



// Use the value of the `x-mock-response-code` header if it exists, is not disabled, and if the `use-response-code` 
// environment variable is set to `true`.  The header is configured in the pre-request script
if(pm.request.headers.has("x-mock-response-code")) {
  
  var status = pm.request.headers.one("x-mock-response-code").disabled ? 200 : parseInt(pm.request.headers.get("x-mock-response-code"));
    
    status = (status == undefined || isNaN(status)  ? 200 : status);
}

//Hardcode status to something different from that returned by the above
//This code executes if the `force_conflict` collection variable is set to true AND `use_mock_response` is set to true AND `response-code` is not 200
if(config.forceValidationConflict)
{
  status = 200;
  
}
  

// First Test - Baseline Status Code
pm.test("Status code is " + status, function () {
    pm.response.to.have.status(status);
});







const apiRequest = {
  url: api_url,
  method: 'GET',
  header: 'X-Api-Key:' + postman_api_key,
};
//Get the API
pm.sendRequest(apiRequest, function (err, res) {
     //console.log("Sending the req");
    if (err) {
        pm.test('Error fetching schema for the ' + api + ': ' + e.message, function() {
                pm.expect(false).to.be.true;
            });
    } else {   

        // Pull Schema from API response        
        var api_response = res.json();  
        var schemaJson = jsyaml.load(api_response.schema.schema);
        
        
        //var resBodySchemaData = getSubSchemaYaml(path, method, api_response.schema.schema, "response");
        
        var resBodySchemaData = getResponseSchema(schemaJson, path, method, status, 'application/json');
        var reqBodySchemaData = getRequestSchema(schemaJson, path, method);
        
        const bodyValid = validate(pm.response.json(), resBodySchemaData.schema);
        if(reqBodySchemaData.ref != 'No Ref' && config.validate.requestParams) {
          pm.test('Validating parameters against ' + reqBodySchemaData.ref + ' schema from the ' + api + ' OpenAPI', function() {
            var valMsgs = validatePropertyList(schemaJson, reqBodySchemaData.schema, pm.request);
            const paramsValid = (valMsgs.length === 0);
              pm.expect(paramsValid).to.be.true;
          });
      }
        


        if(reqBodySchemaData.ref !== 'No Ref' && config.validate.requestBody) {
            pm.test('Validating request body against ' + reqBodySchemaData.ref + ' schema from the ' + api + ' OpenAPI', function() {
              const reqValid = validate(JSON.parse(pm.request.body.raw), reqBodySchemaData.bodySchema);
                pm.expect(reqValid).to.be.true;
            });
        }
        else {
                pm.test(config.validate.requestBody ? 'No request body for path ' + path +  'from the ' + api + ' OpenAPI' : 'Skipping Request Body tests', function() {
                pm.expect(true).to.be.true;
            });
        }
        if(resBodySchemaData.ref !== 'No Ref' && config.validate.responseBody) {
            pm.test('Validating response body against ' + resBodySchemaData.ref + ' schema from the ' + api + ' OpenAPI', function() {
                
                pm.expect(bodyValid).to.be.true;
            });
        }
        else {
                pm.test(config.validate.responseBody ? 'No request body for path ' + path +  'from the ' + api + ' OpenAPI' : 'Skipping Response Body tests', function() {
                pm.expect(true).to.be.true;
            });
        }
        
    }    

});