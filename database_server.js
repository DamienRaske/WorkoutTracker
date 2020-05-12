const PORT = 8080;

//Setup the connection to the database
var mysql = require('mysql');
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "J6fsGE5c338J",
  database: "workout_tracker_db"
});

/*
* Helper function to get data from the database
* @param sqlQuery - The SQL query to retrieve the data
* @return A promise containing the results of the query
*/
const getQuery = function(sqlQuery){
    return new Promise((resolve, reject) => {       
        con.query(sqlQuery, function (error, result, fields) {
            if (error){
                reject(error);
            }
            else{
                resolve(result);
            }
        });
    });
}

/*
* Helper function that executes a SQL query then sends the results to the client
* @param res - Contains information about the response to the request
* @param query - The SQL query that will be executed
*/
async function sendDatabaseResponse(res, query){
    try{
        const queryResult = await getQuery(query);
        res.status(200);
        res.send(queryResult);
    }
    catch (error){
        console.log("Query Failed: " + query + "\nError: " + error)
        res.status(500);
        res.send('Server Error: Query failed');
    }
}

//Setup express
const express = require('express');
const app = express();

//Parse the body of the request
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

//Verify that the authorization token is valid for all request
app.use('/', (req, res, next) => {
    if(req.get('Authorization') != 'Bearer gjT0EsKnxSwmiG6nVl9w06b4cxnF0gvW8lOVPmITXI3R'){
        res.status(401);
        res.send('401 Unauthorized');
    }
    else{
        next();
    }
});

/*
* Adds a new user to the database if the user does not exist
* @param email - The users email address
* @param name - The name of the user
*/
app.post('/new_user', async (req, res) => {
    try{
        const queryResult = await getQuery('SELECT COUNT(*) AS numUsers FROM user WHERE email = \'' + req.body.email + '\'');
        if(queryResult[0].numUsers == 0){
            await getQuery('INSERT INTO user VALUES (\'' + req.body.email + '\', \'' + req.body.name +'\')');
        }

        res.status(200);
        res.send();
    }
    catch (error){
        res.status(500);
        res.send('New User Query Failed');
    }       
});

/*
* Returns exercise details for a given workout of a given user
*/
app.get('/workoutDetails/:workoutName/:email', (req, res) => {
    sendDatabaseResponse(res, 'SELECT exercise.name, exercise.rep_count, exercise.set_count, exercise.weight, exercise_muscle_group.muscle_group FROM (((workout INNER JOIN workout_exercise ON workout.name = workout_exercise.workout_name AND workout.user_email = workout_exercise.user_email) INNER JOIN exercise ON workout_exercise.exercise_name = exercise.name AND workout_exercise.user_email = exercise.user_email) INNER JOIN exercise_muscle_group ON exercise.name = exercise_muscle_group.exercise_name AND exercise.user_email = exercise_muscle_group.user_email) WHERE exercise.user_email = \'' + req.params.email + '\' AND workout.name = \'' + req.params.workoutName + '\' ORDER BY workout_exercise.position ASC');
});

/*
* Returns the names of all workouts for a given user
*/
app.get('/workouts/:email', (req, res) => {
    sendDatabaseResponse(res, 'SELECT name FROM workout WHERE user_email = \'' + req.params.email + '\'');
});

/*
* Deletes a workout with the given name from the database
* @param user_email - The email adress of the user who the workout should be deleted for
*/
app.post('/workout/delete/:workoutName', (req, res) => {
    sendDatabaseResponse(res, 'DELETE FROM workout WHERE user_email = \'' + req.body.user_email + '\' AND name = \'' + req.params.workoutName + '\''); 
});

/*
* Adds a new workout to the database
* @param name - The name of the new workout
* @param user_email - The user creating the workout
*/
app.post('/workout/create', (req, res) => {
    sendDatabaseResponse(res, 'INSERT INTO workout VALUES (\'' + req.body.name + '\', \'' + req.body.user_email +'\')'); 
});

/*
* Updates the name and exercises associated with a workout
* @param name - The new name of the workout
* @param previousName - The old name of the workout
* @param user_email - The user updating the workout
* @param exercises - Array of exercises associated with the workout (Sorted according to order of execution)
*/
app.post('/workout/save', async (req, res) => {
    try{
        con.beginTransaction();
        
        //Update the name of the workout if it changed
        if(req.body.name != req.body.previousName){
            await getQuery('UPDATE workout SET workout.name = \'' + req.body.name + '\' WHERE workout.name = \'' + req.body.previousName + '\' AND workout.user_email = \'' + req.body.user_email + '\'');
        }
        
        //Delete all exercises associated with the old workout
        await getQuery('DELETE FROM workout_exercise WHERE user_email =\'' + req.body.user_email + '\' AND workout_name = \'' + req.body.name + '\'');
        
        //Add all exercises associated with the new workout
        var insertQuery = 'INSERT INTO workout_exercise VALUES '
        for(var i = 0; i < req.body.exercises.length; i++){
            insertQuery += '(\'' + req.body.user_email + '\', \'' + req.body.name + '\', \'' + req.body.exercises[i] + '\', ' + i + ')';
            if(i + 1 < req.body.exercises.length){
                insertQuery += ', ';
            }
        }
        await getQuery(insertQuery);
        
        con.commit();
        
        res.status(200);
    }
    catch(error){        
        console.log(error);
        con.rollback();
        res.status(500);
    }
    
    res.send();
});

/*
* Returns the name of the workout for the current day of the week for a given user
*/
app.get('/todaysWorkout/:email', (req, res) => {
    //Get the current day of the week
    const date = new Date();
    var day = "Sunday";
    switch (date.getDay()) {
        case 0:
            day = "Sunday";
            break;
        case 1:
            day = "Monday";                    
            break;
        case 2:
            day = "Tuesday";                   
            break;
        case 3:
            day = "Wednesday";
            break;
        case 4:
            day = "Thursday";
            break;
        case 5:
            day = "Friday";
            break;
        case 6:
            day = "Saturday";
            break;
    }
    
    sendDatabaseResponse(res, 'SELECT workout_name FROM routine WHERE user_email = \'' + req.params.email + '\' AND day = \'' + day + '\'');
});

/*
* Returns information about an exercise in a given workout at a given index for a given user
*/
app.get('/workout/:workoutName/:exercisePosition/:email', (req, res) => {
    sendDatabaseResponse(res, 'SELECT exercise.name, exercise.set_count, exercise.rep_count, exercise.weight FROM exercise INNER JOIN workout_exercise ON exercise.name = workout_exercise.exercise_name AND exercise.user_email = workout_exercise.user_email WHERE workout_exercise.user_email = \'' + req.params.email + '\' AND workout_exercise.workout_name = \'' + req.params.workoutName + '\' AND workout_exercise.position = ' + req.params.exercisePosition);
});

/*
* Returns information about all exercises for a given user
*/
app.get('/exercises/:email', (req, res) => {
    sendDatabaseResponse(res, 'SELECT exercise.name, exercise.set_count, exercise.rep_count, exercise.weight, exercise_muscle_group.muscle_group FROM exercise INNER JOIN exercise_muscle_group ON exercise.user_email = exercise_muscle_group.user_email AND exercise.name = exercise_muscle_group.exercise_name WHERE exercise.user_email = \'' + req.params.email + '\'');
});

/*
* Adds a new exercise to the database
* @param name - The name of the exercise
* @param user_email - The user creating the exercise
* @param set_count - The number of sets performed during the exercise
* @param rep_count - The number of reps performed during a set
* @param weight - The amount of weight to use during the exercise
* @param muscle_group - The primary muscle group used during the exercise
*/
app.post('/exercise/create', async (req, res) => {
    try{
        con.beginTransaction();
        
        await getQuery('INSERT INTO exercise VALUES (\'' + req.body.name + '\', \'' + req.body.user_email + '\', \'' + req.body.set_count + '\', \'' + req.body.rep_count + '\', \'' + req.body.weight + '\')');
        await getQuery('INSERT INTO exercise_muscle_group VALUES (\'' + req.body.name + '\', \'' + req.body.user_email + '\', \'' + req.body.muscle_group + '\')');
        
        con.commit();
        
        res.status(200);
    }
    catch(error){
        console.log(error);
        con.rollback();
        res.status(500);
    }
    
    res.send();
});

/*
* Deletes an exercise from the database
* @param user_email - The email address of the user deleting the exercise
* @param name - The name of the exercise
*/
app.post('/exercise/delete', (req, res) => {
    sendDatabaseResponse(res, 'DELETE FROM exercise WHERE user_email =\'' + req.body.user_email + '\' AND name = \'' + req.body.name + '\'');
});

/*
* Updates the information about an exercise
* @param name - The new name of the exercise
* @param user_email - The user updating the exercise
* @param set_count - The new set count
* @param rep_count - The new rep count
* @param weight - The new weight
* @param previous_name - The previous name of the exercise
* @param muscle_group - the new muscle group
*/
app.post('/exercise/save', async (req, res) => {
    try{
        con.beginTransaction();
        
        await getQuery('UPDATE exercise SET exercise.name = \'' + req.body.name + '\', exercise.user_email = \'' + req.body.user_email + '\', exercise.set_count = \'' + req.body.set_count + '\', exercise.rep_count = \'' + req.body.rep_count + '\', exercise.weight = \'' + req.body.weight + '\' WHERE user_email =\'' + req.body.user_email + '\' AND name = \'' + req.body.previous_name + '\'');
        
        await getQuery('UPDATE exercise_muscle_group SET exercise_muscle_group.muscle_group = \'' + req.body.muscle_group + '\' WHERE user_email =\'' + req.body.user_email + '\' AND exercise_name = \'' + req.body.name + '\'');
        
        con.commit();
        
        res.status(200);
    }
    catch(error){
        console.log(error);
        con.rollback();
        res.status(500);
    }
    
    res.send();
});

/*
* Returns the exercise history of a given exercise for a given user
*/
app.get('/exercise/:exerciseName/history/:userEmail', (req, res) => {
    sendDatabaseResponse(res, 'SELECT date, weight FROM exercise_history WHERE user_email = \'' + req.params.userEmail + '\' AND exercise_name = \'' + req.params.exerciseName + '\'');
});

/*
* Adds a new data point to the exercise history
* @param exercise_name - The name of the exercise
* @param user_email - The user who performed the exercise
* @param weight - The weight used during the exercise
* @param date - The date the exercise was performed
*/
app.post('/exercise/history', (req, res) => {
    sendDatabaseResponse(res, 'INSERT IGNORE INTO exercise_history VALUES (\'' + req.body.exercise_name + '\', \'' + req.body.user_email + '\', \'' + req.body.weight + '\', \'' + req.body.date + '\')');
});

/*
* Updates the weight that should be used during an exercise
* @param name - The name of the exercise
* @param user_email - The user updating the weight
* @param weight - The new weight to use during the exercise
*/
app.post('/exercise/updateWeight', (req, res) => {
    sendDatabaseResponse(res, 'UPDATE exercise SET exercise.weight = ' + req.body.weight + ' WHERE user_email = \'' + req.body.user_email + '\' AND name = \'' + req.body.name + '\'');
});

/*
* Returns the workout routine for a given user
*/
app.get('/routine/:email', (req, res) => {
    sendDatabaseResponse(res, 'SELECT workout_name, day FROM routine WHERE user_email = \'' + req.params.email + '\'');
});

/*
* Updates the user's routine in the database
* @param 'sunday'-'saturday' - The name of the workout on each day
* @param user_email - The user who is updating their routine
*/
app.post('/routine/update', (req, res) => {
    try{
        con.beginTransaction();
        
        //Update the workout for each day of the week
        updateRoutineDay("Sunday", req.body.sunday, req.body.user_email);
        updateRoutineDay("Monday", req.body.monday, req.body.user_email);
        updateRoutineDay("Tuesday", req.body.tuesday, req.body.user_email);
        updateRoutineDay("Wednesday", req.body.wednesday, req.body.user_email);
        updateRoutineDay("Thursday", req.body.thursday, req.body.user_email);
        updateRoutineDay("Friday", req.body.friday, req.body.user_email);
        updateRoutineDay("Saturday", req.body.saturday, req.body.user_email);
        
        con.commit();
        
        res.status(200);
    }
    catch(error){
        console.log(error);
        con.rollback();
        res.status(500);
    }
    
    res.send();
});

/*
* Helper function for updating a users routine
* @param day - The day of the week in the routine
* @param value - The name of the workout to be performed
* @param user_email - The user updating their routine
*/
async function updateRoutineDay(day, value, user_email){
    try{
        if(value == null){
            const queryResult = await getQuery('DELETE FROM routine WHERE user_email = \'' + user_email + '\' AND day = \'' + day + '\'');
        }
        else{
            const queryResult = await getQuery('REPLACE INTO routine VALUES (\'' + value + '\', \'' + user_email + '\', \'' + day + '\')');
        }
    }
    catch (error) {
        throw(error);
    }
}

/*
* Get all muscle groups worked by a given user's routine
*/
app.get('/routine/:email/muscleGroups', (req, res) => {
    sendDatabaseResponse(res, 'SELECT exercise_muscle_group.muscle_group, routine.day FROM routine INNER JOIN workout_exercise ON routine.user_email = workout_exercise.user_email AND routine.workout_name = workout_exercise.workout_name INNER JOIN exercise_muscle_group ON exercise_muscle_group.user_email = routine.user_email AND exercise_muscle_group.exercise_name = workout_exercise.exercise_name WHERE routine.user_email = \'' + req.params.email + '\'');
});

app.listen(PORT, () => {
  console.log("Running on port: " + PORT);
});