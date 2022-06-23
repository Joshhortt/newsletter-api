const bodyParser = require('body-parser'); // Fetching inputs.
const express = require('express'); // Local server.
const https = require('https');
//npm i @mailchimp/mailchimp_marketing
const mailChimp = require("@mailchimp/mailchimp_marketing");
//const moment = require('moment'); // Date manipulation.
const request = require('request'); // Gets.
 
// Create Mail Chimp config object.
const oMCConfig = {
   sAPIKey: 'e041e9d267991322a2a21e6cf7dc139c-us11', // Bad value causes 401 error.
   sAudienceId: 'a2c3788789',
   sServer: 'us-11',   // Bad value causes .on('error')... to fire.
   sURLRoot: '.API.MailChimp.com/3.0/lists/', // Bad value causes 404 error.
}
oMCConfig.sURL = `https://${oMCConfig.sServer}${oMCConfig.sURLRoot}${oMCConfig.sAudienceId}`;
console.log('MCConfig:');
console.log(oMCConfig); // Or use JSON.stringify() to prevent [object object] if text output before object in same statement.
 
const oServer = {
   iPort: process.env.PORT || 3000,  // If PORT does not exist, use local value. From next lesson.
   sRoot: 'public',
   sRouteNew: '/n', // New.
   sRouteAdd: '/a', // Add.
   sRouteFailure: '/f',  // Failure.
   sRouteRoot: '/' // Test.
}
oServer.sRootFull = __dirname + '/' + oServer.sRoot + '/';
console.log('Server:');
console.log(oServer);
 
// Create Files object.
const oFiles = {
   sFailure: oServer.sRootFull + 'failure.html',
   sSignUp: oServer.sRootFull + 'signup.html',
   sSuccess: oServer.sRootFull + 'success.html'
}
console.log('Files:');
console.log(oFiles);
 
//Requires express and body parser and initialize the constant "app".
const app = express();
app.use(express.static(oServer.sRoot)); // allow relative URL references in html files.
app.use(bodyParser.urlencoded({
   extended: true
}));
 
app.listen(oServer.iPort, function() {
   let sTemp = `Express server started on port ${oServer.iPort}.`;
   sTemp += `  Use localhost:${oServer.iPort + oServer.sRouteNew}.`;
   sTemp += `  Root:${oServer.sRootFull}.`;
   console.log(sTemp);
});
 
app.get(oServer.sRouteRoot, function(req, res) {
   res.send(`Server is up and running on port ${oServer.iPort} at ${oServer.sRootFull}.`);
});
 
// Reserve root for testing.  Use /i to start the webpage.
app.get(oServer.sRouteNew, function(req, res) {
   console.log(oFiles.sSignUp);
   res.sendFile(oFiles.sSignUp);
});
 
app.post(oServer.sRouteAdd, function(req, res) {
   res.redirect(oServer.sRouteNew);
});
 
app.post(oServer.sRouteFailure, function(req, res) {
   res.redirect(oServer.sRouteNew);
});
 
app.post(oServer.sRouteNew, function(browserReq, browserRes) {
   const oMCOptions = {
      method: 'POST',
      auth: 'ce:' + oMCConfig.sAPIKey
   };
   console.log('Options:');
   console.log(oMCOptions);
 
   //? Configure request that will be sent upon executing APIReq.end() command?
   const APIReq = https.request(oMCConfig.sURL, oMCOptions, function(APIRes) {
      APIRes.on('data', function(hData) { // Setup and wait for API response.
         let oData = JSON.parse(hData); // Process API response.
         // Some MailChimp's responses do not include a status value.
         // oData.status will be undefined for a completed response even if there is a configuration error..
         let bError = oData.status !== undefined; // undefined (MC has an internal error)= false.
         bError = bError && oData.status != 200;  // if status in found and not 200...
         if (bError) { // Oops.  Something when wrong with the request, status was found, but not 200.
            console.log(oData);
            sTemp = `Error: ${oData.status} (${oData.title}) = ${oData.detail}`
            console.log(sTemp);
            browserRes.send(sTemp);
         } else { // Received a proper response.
            console.log(oData);
            //d notifyOnce(browserRes, JSON.parse(oData));
            let iErrors = oData.error_count;
            console.log('errors:' + iErrors);
            bError = iErrors != 0;
            if (bError) { // Internal error: Something when wrong with the input.
               let sError = oData.errors[0].error;
               let sErrorCode = oData.errors[0].error_code;
               let sTemp = `Error: ${sErrorCode} = ${sError}`;
               console.log(sTemp);
               //a browserRes.sendFile(oFiles.sFailure);
               browserRes.sendFile(oFiles.sFailure);
            } else { // (iErrors == 0)
               let sTemp = `Success: Added contact as an audience member`;
               sTemp += ` with an id of ${oData.new_members[0].id}.`;
               console.log(sTemp);
               browserRes.sendFile(oFiles.sSuccess);
            } // eo if(bError).
         } // eo if(!=200).
      }); // eo APIRes.on().
   }); // eo https.request().
 
   //Create required object using user's input data.
   const oSubscriber = {
      members: [{
         email_address: browserReq.body.email,
         status: "subscribed",
         merge_fields: {
            FNAME: browserReq.body.firstName,
            LNAME: browserReq.body.lastName
         }
      }]
   };
 
   // Occures when ENOTFOUND (bad address/timeout/no response/bad us#).  Server crashes without this code.
   APIReq.on('error', (oEvnt) => {
     console.error('onError:');
     console.log(oEvnt);
     browserRes.sendFile(oFiles.sFailure);
   });
 
   const sJsonData = JSON.stringify(oSubscriber);
 
   APIReq.write(sJsonData);
   APIReq.end(); // Submit ask/query.
 
});