const express = require("express");

const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

const app = express();
app.use(express.json());

let db = null;

const DbAndServerInitialization = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
  app.listen(3000, () => {
    console.log("3,2,1....Ready To GO...");
  });
};

DbAndServerInitialization();

const feedObj = (dbObj) => {
  return {
    username: dbObj.username,
    tweet: dbObj.tweet,
    dateTime: dbObj.date_time,
  };
};

//Register an User in Twitter Account
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const Query = `select * from user where username='${username}'`;
  const QueryResult = await db.get(Query);
  if (QueryResult != undefined) {
    response.status(400);
    response.send("User already exists");
  } else if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    let hashedPassword = await bcrypt.hash(password, 10);
    const InsertQuery = `Insert into user(name,username,password,gender) values('${name}','${username}','${hashedPassword}','${gender}')`;
    await db.run(InsertQuery);
    response.status(200);
    response.send("User created successfully");
  }
});

//Login an user in Twitter Account
app.post("/login", async (request, response) => {
  const { username, password } = request.body;

  const Query = `select * from user where username='${username}'`;
  const QueryResult = await db.get(Query);

  if (QueryResult === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const hashedPassword = await bcrypt.compare(password, QueryResult.password);

    if (hashedPassword) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "KOLKATAKNIGHTRIDERS");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Middleware for Authentication
const authenticateToken = async (request, response, next) => {
  let authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "KOLKATAKNIGHTRIDERS", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//Returns the latest 4 tweets of people whom the user follows
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const selectQuery = `select username ,tweet,date_time 
   from 
   tweet
   natural join
   user
   inner join
   follower 
   on user.user_id=follower.follower_user_id
   Order by date_time desc LIMIT 4 `;
  const result = await db.all(selectQuery);

  response.send(result.map((each) => feedObj(each)));
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectQuery = `select P.username from
  (user 
  join
  follower on user.user_id=follower.follower_user_id) as T
  join 
  user as P 
  on T.following_user_id=P.user_id;
  where P.username='${username}'
  
  `;

  const result = await db.all(selectQuery);

  response.send(result);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const selectQuery = `select P.username from
  (user 
  join
  follower on user.user_id=follower.following_user_id) as T
  join 
  user as P 
  on T.follower_user_id=P.user_id
  where P.username='${username};
  
  `;

  const result = await db.all(selectQuery);

  response.send(result);
});

module.exports = app;
