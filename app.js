const express = require("express");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//Authentication with token

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "aaabbbccc", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`); //provided invalid token
      } else {
        next(); //will execute api handler
      }
    });
  } else {
    response.status(401);
    response.send(`Invalid JWT Token`); //Scenario 1
  }
};

//API 1 Login-all login scenarios + jwt tokwn generations

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserLoginQuery = `SELECT * 
    FROM user WHERE 
    username='${username}';`;
  const dbUser = await db.get(getUserLoginQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrectPassword = await bcrypt.compare(password, dbUser.password);
    if (isCorrectPassword === true) {
      //only if pwd is matched that we are generating jwt token

      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "aaabbbccc");
      response.send({ jwtToken });
    } else {
      //invalid password
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2 /states/

app.get("/states", authenticateToken, async (request, response) => {
  const listOfStatesQuery = `SELECT 
        state_id as stateId,state_name as stateName,
        population FROM 
        state;`;
  const listOfStates = await db.all(listOfStatesQuery);
  response.send(listOfStates);
});

//API 3 returns a state based on state Id

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT state_id as stateId,
        state_name as stateName,population FROM state 
        WHERE state_id=${stateId};`;

  const stateResponse = await db.get(getStateQuery);
  response.send(stateResponse);
});

//API 4 Create a district in the district table, district_id is auto-incremented

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `INSERT INTO district(district_name,state_id,
        cases,cured,active,deaths) 
        VALUES('${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths});`;
  const districtResponse = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//API 5 Returns a district based on the district ID

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT district_id as districtId,
    district_name as districtName,state_id as stateId,
    cases,cured,active,deaths FROM district 
    WHERE district_id=${districtId};`;
    const districtSelected = await db.get(getDistrictQuery);
    response.send(districtSelected);
  }
);

//API 6 Delete district

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE 
    district_id=${districtId};`;
    const deleteResponse = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);
//API 7 update the details of specific district

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistQuery = `UPDATE district SET 
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths} 
    WHERE district_id=${districtId};`;

    const updateDist = await db.run(updateDistQuery);
    response.send("District Details Updated");
  }
);

//API 8-Returns the statistics of total cases, cured, active, deaths of a specific state based on state ID

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateSpecificDetailsQuery = `
  SELECT  
    sum(cases) as totalCases, 
    sum(cured) as totalCured,
    sum(active) as totalActive, 
    sum(deaths) as totalDeaths 
    FROM
    district
    WHERE state_id = ${stateId};`;

    const stateDetailsResponse = await db.get(getStateSpecificDetailsQuery);
    response.send(stateDetailsResponse);
  }
);

module.exports = app;
