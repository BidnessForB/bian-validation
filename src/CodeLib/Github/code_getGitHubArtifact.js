/*
 * Example showing the code to retrieve snippets from GitHub
 * for use as pre-reqiuest scripts. Stored in the code_getGitHubArtifact
 * environment variable.
 * 
 * NOTE: Pushing this code to the SCM WILL NOT update it in relevant collections.  Copy and paste it into 
 * the Environment variable in the Postman UX.
*/
debugger;
//Setup the URL components
var ghci = JSON.parse(pm.collectionVariables.get('gh_config'));
console.log(ghci);
token = pm.environment.get("GitHub_PAT");
for(i = 0; i < ghci.files.length; i++)
{
    var file = ghci.files[i];
    
    baseUrl = 'https://api.github.com'
    //Build the URL.  If ref is defined and not '', append it to pull from the specific ref (branch)
    var url = baseUrl + "/repos/" + ghci.slug + "/contents/" + file.path + ((ghci.ref === undefined || ghci.ref === null || ghci.ref === '') ? '' : '?ref=' + ghci.ref);
    const postRequest = {
    url: url,
    method: 'get',
    header: {
    'Content-Type': 'application/json',
    'Authorization': 'bearer ' + token
    }
    };
    sendRequest(postRequest, file.target);
}    
    
function sendRequest(postRequest, target) {
    
    pm.sendRequest(postRequest, (err,res) =>  {
        //JSON-ize the response
        var jsonData = JSON.parse(res.text());
        //Get the base64 git BLOB data from the response
        var base64content = jsonData.content;
        //Decode the base64
        var buff = Buffer.from(base64content, 'base64');
        //Drop the decoded content to a UTF8 string
        var content = buff.toString('ascii');
        //Set the value of the collection variable 
        pm.collectionVariables.set(target, content);
    });
}
