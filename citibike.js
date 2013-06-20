/* jshint node: true */
"use strict";

var clues = require("clues"),
    express = require("express"),
    request = require("request"),
    cheerio = require("cheerio");

var fields = ['trip','start_station','start_date','end_station','end_date','duration','distance'];

var api = {};

api.connect = function(resolve,reject) {
  var jar = request.jar();
  request({
    url:"https://citibikenyc.com/login",
    method:"GET",
    jar : jar
  },function(err,res,body) {
    var $ = cheerio.load(body),
        token = $("[name=ci_csrf_token]").attr("value");
    if (!token || !token.length) return reject("Token not found");
    resolve({jar:jar,token:token});
  });
};

api.login = function(connect,username,password,local,resolve,reject) {
  var form = {
      subscriberUsername: username,
      subscriberPassword: password,
      login_submit: "Login",
      ci_csrf_token : connect.token
    };

  request({
    followAllRedirects : true,
    url:"https://citibikenyc.com/login",
    jar : connect.jar,
    form: form,
    method:"POST"
  },function(err,response,body) {
    console.log("logged in");
    if (err) return reject(err);
    if (body.match(/password you entered does not match our records/))
      return reject("Invalid login");
    return resolve(connect);
  });
},

// By default we don't show trips under a minute. 
api.full = false;

api.trips = function(login,full,connect,resolve,reject) {
  request({
    followAllRedirects : true,
    url : "https://citibikenyc.com/member/trips",
    jar : connect.jar,
    method: "GET"
  },function(err,response,body) {
    if (err) return reject(err);

    var $ = cheerio.load(body);
    var res = $("tbody tr").map(function(i) {
      var obj =  {};
      $(this).find("td").each(function(i) {
        obj[fields[i]] = $(this).text();
      });
      return obj;
    });

    // unless full recordset is requested, we remove any trips under a minute
    if (!full) res = res.filter(function(d) {
      return d.duration.slice(0,2) != '0m';
    });

    resolve(res);
  });
};

// Fetch default user/pass from environment variables (if exists)
api.username = process.env.citibike_user;
api.password = process.env.citibike_pass;

var express = require("express"),
    app = express();

app.get("/", function(req,res,next) {
  return clues(api,req.query)
    .solve("trips")
    .then(function(d) { res.end(d.body || JSON.stringify(d)); },
          function(d) { res.end(d.body || JSON.stringify(d)); });
});

var port = process.env.PORT || 5000;
app.listen(port,function() {
  console.log("listening to port "+port);
});

app.listen(3000);
