const Alexa = require('ask-sdk');
const http = require('http');
const https = require("https");

const DATABASE_URL = "http://jolly-bear-34.localtunnel.me";

const DEFAULT_OPTIONS = {
    headers: {
        "Authorization": "Bearer gjT0EsKnxSwmiG6nVl9w06b4cxnF0gvW8lOVPmITXI3R"
    }
};

/**
 * Helper function for making an http request
 */
const httpReq = function(url, options, postData) {
    return new Promise((resolve, reject) =>{
        const request = http.request(url, options, function (response) {
            response.setEncoding("utf8");
    
            if (response.statusCode < 200 || response.statusCode >= 300) {
                reject("Error " + response.statusCode);
            }
            else{
                let responseData = "";
                response.on("data", function(chunk) {
                    responseData += chunk;
                });
    
                response.on("end", function() {
                    resolve(responseData);
                });
            }
        }); 
        
        if(options.method === "POST" && postData){
            request.write(postData);
        }
        
        request.end();
    }).catch(function(error){
        console.log(error + " - httpReq()");
        throw(error);
    });
}

/**
 * Helper function for making an https request
 */
const httpsReq = function(url, options, postData) {
    return new Promise((resolve, reject) =>{
        const request = https.request(url, options, function (response) {
            response.setEncoding("utf8");
    
            if (response.statusCode < 200 || response.statusCode >= 300) {
                reject("Error " + response.statusCode);
            }
            else{
                let responseData = "";
                response.on("data", function(chunk) {
                    responseData += chunk;
                });
    
                response.on("end", function() {
                    resolve(responseData);
                });
            }
        }); 
        
        if(options.method === "POST" && postData){
            request.write(postData);
        }
        
        request.end();
    }).catch(function(error){
        console.log(error + " - httpsReq()");
        throw(error);
    });
}

/**
 * Checks that the user is authenticated
 * @param accessToken - The user's access token from google
 * @param handlerInput - Information about the user from Alexa
 */
async function isAuthenticated(accessToken, handlerInput){
    let bAuthenticated = false;
    
    if(handlerInput){
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        
        if(attributes.email !== undefined){
            bAuthenticated = true;
        }
        else if(accessToken){
            try{
                // Get user email from Google
                const userInfo = await httpsReq("https://www.googleapis.com/oauth2/v1/userinfo?access_token=" + accessToken, {});
                const userInfoJson = JSON.parse(userInfo);
                
                // Store the email
                attributes.email = userInfoJson.email;
                handlerInput.attributesManager.setPersistentAttributes(attributes);
                handlerInput.attributesManager.savePersistentAttributes();
                
                bAuthenticated = true;
            }
            catch(error){
                console.log("Error: Unable to access Google API");
            }
        }
        
    }
    
    return bAuthenticated;
}

const LaunchRequestHandler = {
	canHandle(handlerInput) {
		const request = handlerInput.requestEnvelope.request;
		return request.type === "LaunchRequest";
	},
	handle(handlerInput) {
		return handlerInput.responseBuilder
			.speak("Welcome to Workout Tracker. To start todays workout, say 'Start workout'.")
			.reprompt("To start todays workout, say 'Start workout'.")
			.getResponse();
	}
};

const HelpHandler = {
	canHandle(handlerInput) {
		const request = handlerInput.requestEnvelope.request;
		return request.type === "IntentRequest" && (request.intent.name === "AMAZON.FallbackIntent" || request.intent.name === "AMAZON.HelpIntent");
	},
	async handle(handlerInput) {
		let speakOutput = null;
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(attributes.activeWorkout !== undefined){
            speakOutput = "To start your next exercise, say 'Next Exercise'. To skip or go back to an exercise, say 'Skip' or 'Go back'.\
                You can also ask me to repeat information about the current exercise. To end the workout, say 'End Workout'."; 
        }
        else{
            speakOutput = "To start todays workout say 'Start Workout'.";
        }
		
		return handlerInput.responseBuilder
			.speak(speakOutput)
			.getResponse();
	}
};

const CancelHandler = {
    canHandle(handlerInput) {
		const request = handlerInput.requestEnvelope.request;
		return request.type === "IntentRequest" && (request.intent.name === "AMAZON.CancelIntent" || request.intent.name === "AMAZON.StopIntent");
	},
	handle(handlerInput) {
		return handlerInput.responseBuilder
			.speak("Goodbye!")
			.withShouldEndSession(true)
			.getResponse();
	}
};

/**
 * Starts the user's workout for today
 */
const StartWorkoutHandler = {
    canHandle(handlerInput){
        const request = handlerInput.requestEnvelope.request;
        return request.type === "IntentRequest" && (request.intent.name === "StartWorkoutIntent");
    },
    async handle(handlerInput){
        // Check that the user has linked their account
        const { accessToken } = handlerInput.requestEnvelope.context.System.user;
        if(!await isAuthenticated(accessToken, handlerInput)){
            return handlerInput.responseBuilder
                .speak("You must link your account in the Alexa App before you can do that.")
                .withLinkAccountCard()
                .getResponse();
        }
        
        // Check that there is not an active workout
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(attributes.activeWorkout !== undefined){
            return handlerInput.responseBuilder
                .speak("You have already started your " + attributes.activeWorkout + ". To end the active workout, say 'End Workout'.")
                .reprompt("To end the active workout, say 'End Workout'.")
                .getResponse(); 
        }
        
        try{
            // Get todays workout
            const workoutResult = await httpReq(DATABASE_URL + "/todaysWorkout/" + attributes.email, DEFAULT_OPTIONS);
            const workoutResultJson = JSON.parse(workoutResult);
            
            let speakOutput = null;
            if(Object.keys(workoutResultJson).length > 0){
                // Get the first exercise of todays workout
                const exerciseResult = await httpReq(DATABASE_URL + "/workout/" + workoutResultJson[0].workout_name + "/0/" + attributes.email, DEFAULT_OPTIONS);
                const exerciseResultJson = JSON.parse(exerciseResult);
                
                if(Object.keys(exerciseResultJson).length > 0){
                    // Store workout and exercise data
                    attributes.exerciseIndex = 0;
                    attributes.activeWorkout = workoutResultJson[0].workout_name;
                    attributes.activeExerciseName = exerciseResultJson[0].name;
                    attributes.activeExerciseSets = exerciseResultJson[0].set_count;
                    attributes.activeExerciseReps = exerciseResultJson[0].rep_count;
                    attributes.activeExerciseWeight = exerciseResultJson[0].weight;
                    handlerInput.attributesManager.setPersistentAttributes(attributes);
                    handlerInput.attributesManager.savePersistentAttributes();
                    
                    // Create speak output
                    speakOutput = "Starting "  + workoutResultJson[0].workout_name + ". Your first exercise is " + exerciseResultJson[0].name + ". Do " + exerciseResultJson[0].set_count + " sets of " + exerciseResultJson[0].rep_count + " with " + exerciseResultJson[0].weight + " pounds.";
                }
                else{
                    speakOutput = workoutResultJson[0].workout_name + " has no exercises.";
                }
            }
            else{
                speakOutput = "You have no workout scheduled for today."
            }
            
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        } 
        catch(error){
            return handlerInput.responseBuilder
                .speak("Sorry, unable to access database at this time. Please try again later.")
                .getResponse();
        }
    }
};

/**
 * Moves the workout to the next exercise or ends the
 * workout if there are no more exercises
 */
const NextExerciseHandler = {
    canHandle(handlerInput){
        const request = handlerInput.requestEnvelope.request;
        return request.type === "IntentRequest" && request.intent.name === "NextExerciseIntent";
    },
    async handle(handlerInput){
        // Check that the user has linked their account
        const { accessToken } = handlerInput.requestEnvelope.context.System.user;
        if(!await isAuthenticated(accessToken, handlerInput)){
            return handlerInput.responseBuilder
                .speak("You must link your account in the Alexa App before you can do that.")
                .withLinkAccountCard()
                .getResponse();
        }
        
        // Check that there is an active workout
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(Object.keys(attributes).length === 0 || attributes.activeWorkout === undefined){
            return handlerInput.responseBuilder
                .speak("You must start a workout before doing that. To start todays workout, say 'Start workout'.")
                .reprompt("To start todays workout, say 'Start workout'.")
                .getResponse(); 
        }
        
        try{
            // Record exercise history
            const date = new Date();
            const postData = {
                exercise_name: attributes.activeExerciseName,
                user_email: attributes.email,
                weight: attributes.activeExerciseWeight,
                date: date.getUTCFullYear() + "-" + (date.getUTCMonth() + 1) + "-" + date.getUTCDate()
            }
            const postJson = JSON.stringify(postData);
            const options = {
                method: "POST",
                headers: {
                    "Authorization": "Bearer gjT0EsKnxSwmiG6nVl9w06b4cxnF0gvW8lOVPmITXI3R",
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postJson)
                }
            };
            httpReq(DATABASE_URL + "/exercise/history", options, postJson).catch(function(error){
                console.log("Error: History not recorded - " + postJson);
            });
        
            // Get the next exercise
            const exerciseResult = await httpReq(DATABASE_URL + "/workout/" + attributes.activeWorkout + "/" + (attributes.exerciseIndex + 1) + "/" + attributes.email, DEFAULT_OPTIONS);
            const exerciseResultJson = JSON.parse(exerciseResult);
            
            var speakOutput = null;
            if(Object.keys(exerciseResultJson).length > 0){
                // Save the new exercise
                attributes.exerciseIndex = attributes.exerciseIndex + 1;
                attributes.activeExerciseName = exerciseResultJson[0].name;
                attributes.activeExerciseSets = exerciseResultJson[0].set_count;
                attributes.activeExerciseReps = exerciseResultJson[0].rep_count;
                attributes.activeExerciseWeight = exerciseResultJson[0].weight;
                handlerInput.attributesManager.setPersistentAttributes(attributes);
                handlerInput.attributesManager.savePersistentAttributes();
                
                speakOutput = "Your next exercise is " + exerciseResultJson[0].name + ". Do " + exerciseResultJson[0].set_count + " sets of " + exerciseResultJson[0].rep_count + " with " + exerciseResultJson[0].weight + " pounds.";
            }
            else{
                speakOutput = "You have completed your " + attributes.activeWorkout + ". Great work!";
                
                // Clean database
                attributes.activeWorkout = undefined;
                attributes.exerciseIndex = undefined;
                attributes.activeExerciseName = undefined;
                attributes.activeExerciseSets = undefined;
                attributes.activeExerciseReps = undefined;
                attributes.activeExerciseWeight = undefined;
                handlerInput.attributesManager.setPersistentAttributes(attributes);
                handlerInput.attributesManager.savePersistentAttributes();
            }
            
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
                
        } 
        catch(error){
            return handlerInput.responseBuilder
                .speak("Sorry, unable to access database at this time. Please try again later.")
                .getResponse();
        }
    }
};

/**
 * Adjust the weight of the active exercise
 */
const AdjustWeightHandler = {
    canHandle(handlerInput){
        const request = handlerInput.requestEnvelope.request;
        return request.type === "IntentRequest" && request.intent.name === "AdjustWeightIntent";
    },
    async handle(handlerInput){
        // Check that the user has linked their account
        const { accessToken } = handlerInput.requestEnvelope.context.System.user;
        if(!await isAuthenticated(accessToken, handlerInput)){
            return handlerInput.responseBuilder
                .speak("You must link your account in the Alexa App before you can do that.")
                .withLinkAccountCard()
                .getResponse();
        }
        
        // Check that there is an active workout
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(Object.keys(attributes).length === 0 || attributes.activeWorkout === undefined){
            return handlerInput.responseBuilder
                .speak("You must start a workout before doing that. To start todays workout, say 'Start workout'.")
                .reprompt("To start todays workout, say 'Start workout'.")
                .getResponse(); 
        }

        // Calulate updated weight
        const weightDelta = handlerInput.requestEnvelope.request.intent.slots.amount.value;
        const direction = handlerInput.requestEnvelope.request.intent.slots.direction.value;
        let updatedWeight = parseInt(attributes.activeExerciseWeight, 10);
        if(direction === "increase"){
            updatedWeight += parseInt(weightDelta, 10);
        }
        else if(direction === "decrease"){
            updatedWeight -= parseInt(weightDelta, 10);
        }
        
        try{        
            // Update exercise weight in the database
            const postData = {
                name: attributes.activeExerciseName,
                user_email: attributes.email,
                weight: updatedWeight
            }
            const postJson = JSON.stringify(postData);
            const options = {
                method: "POST",
                headers: {
                    "Authorization": "Bearer gjT0EsKnxSwmiG6nVl9w06b4cxnF0gvW8lOVPmITXI3R",
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postJson)
                }
            };
            await httpReq(DATABASE_URL + "/exercise/updateWeight", options, postJson);
            
            // Save the updated weight
            attributes.activeExerciseWeight = updatedWeight;
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            handlerInput.attributesManager.savePersistentAttributes();
            
            return handlerInput.responseBuilder
                .speak(attributes.activeExerciseName + " weight " + direction + "d to " + updatedWeight + " pounds.")
                .getResponse();
        }
        catch(error){
            return handlerInput.responseBuilder
                .speak("Sorry, unable to access database at this time. Please try again later.")
                .getResponse();
        }
    }
};

/**
 * Repeat information about the current workout
 */
const GetExerciseHandler = {
    canHandle(handlerInput){
        const request = handlerInput.requestEnvelope.request;
        return request.type === "IntentRequest" && request.intent.name === "GetExerciseIntent";
    },
    async handle(handlerInput){
        // Check that the user has linked their account
        const { accessToken } = handlerInput.requestEnvelope.context.System.user;
        if(!await isAuthenticated(accessToken, handlerInput)){
            return handlerInput.responseBuilder
                .speak("You must link your account in the Alexa App before you can do that.")
                .withLinkAccountCard()
                .getResponse();
        }
        
        // Check that there is an active workout
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(Object.keys(attributes).length === 0 || attributes.activeWorkout === undefined){
            return handlerInput.responseBuilder
                .speak("You must start a workout before doing that. To start todays workout, say 'Start workout'.")
                .reprompt("To start todays workout, say 'Start workout'.")
                .getResponse(); 
        }

        // Get the information on the current exercise
        const speakOutput = "Your current exercise is " + attributes.activeExerciseName + ". Do " + attributes.activeExerciseSets + " sets of " + 
            attributes.activeExerciseReps + " with " + attributes.activeExerciseWeight + " pounds.";
            
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

/**
 * Ends the active workout
 */
const EndWorkoutHandler = {
    canHandle(handlerInput){
        const request = handlerInput.requestEnvelope.request;
        return request.type === "IntentRequest" && request.intent.name === "EndWorkoutIntent";
    },
    async handle(handlerInput){
        // Check that the user has linked their account
        const { accessToken } = handlerInput.requestEnvelope.context.System.user;
        if(!await isAuthenticated(accessToken, handlerInput)){
            return handlerInput.responseBuilder
                .speak("You must link your account in the Alexa App before you can do that.")
                .withLinkAccountCard()
                .getResponse();
        }
        
        // Check that there is an active workout
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(Object.keys(attributes).length === 0 || attributes.activeWorkout === undefined){
            return handlerInput.responseBuilder
                .speak("You must start a workout before doing that. To start todays workout, say 'Start workout'.")
                .reprompt("To start todays workout, say 'Start workout'.")
                .getResponse(); 
        }

        // Clean the database
        attributes.activeWorkout = undefined;
        attributes.exerciseIndex = undefined;
        attributes.activeExerciseName = undefined;
        attributes.activeExerciseSets = undefined;
        attributes.activeExerciseReps = undefined;
        attributes.activeExerciseWeight = undefined;
        handlerInput.attributesManager.setPersistentAttributes(attributes);
        handlerInput.attributesManager.savePersistentAttributes();
            
        return handlerInput.responseBuilder
            .speak("Ended the active workout.")
            .getResponse();
    }
};

/**
 * Get the number of sets that should be completed during the active exercise
 */
const GetSetsHandler = {
    canHandle(handlerInput){
        const request = handlerInput.requestEnvelope.request;
        return request.type === "IntentRequest" && request.intent.name === "GetSetsIntent";
    },
    async handle(handlerInput){
        // Check that the user has linked their account
        const { accessToken } = handlerInput.requestEnvelope.context.System.user;
        if(!await isAuthenticated(accessToken, handlerInput)){
            return handlerInput.responseBuilder
                .speak("You must link your account in the Alexa App before you can do that.")
                .withLinkAccountCard()
                .getResponse();
        }
        
        // Check that there is an active workout
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(Object.keys(attributes).length === 0 || attributes.activeWorkout === undefined){
            return handlerInput.responseBuilder
                .speak("You must start a workout before doing that. To start todays workout, say 'Start workout'.")
                .reprompt("To start todays workout, say 'Start workout'.")
                .getResponse(); 
        }
            
        return handlerInput.responseBuilder
            .speak("Do " + attributes.activeExerciseSets + " sets of " + attributes.activeExerciseReps)
            .getResponse();
    }
};

/**
 * Get the weight that should be used during the active exercise
 */
const GetWeightHandler = {
    canHandle(handlerInput){
        const request = handlerInput.requestEnvelope.request;
        return request.type === "IntentRequest" && request.intent.name === "GetWeightIntent";
    },
    async handle(handlerInput){
        // Check that the user has linked their account
        const { accessToken } = handlerInput.requestEnvelope.context.System.user;
        if(!await isAuthenticated(accessToken, handlerInput)){
            return handlerInput.responseBuilder
                .speak("You must link your account in the Alexa App before you can do that.")
                .withLinkAccountCard()
                .getResponse();
        }
        
        // Check that there is an active workout
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(Object.keys(attributes).length === 0 || attributes.activeWorkout === undefined){
            return handlerInput.responseBuilder
                .speak("You must start a workout before doing that. To start todays workout, say 'Start workout'.")
                .reprompt("To start todays workout, say 'Start workout'.")
                .getResponse(); 
        }
            
        return handlerInput.responseBuilder
            .speak("Use " + attributes.activeExerciseWeight + " pounds.")
            .getResponse();
    }
};

/**
 * Moves the next exercise without recording exercise history
 */
const SkipExerciseHandler = {
    canHandle(handlerInput){
        const request = handlerInput.requestEnvelope.request;
        return request.type === "IntentRequest" && request.intent.name === "SkipExerciseIntent";
    },
    async handle(handlerInput){
        // Check that the user has linked their account
        const { accessToken } = handlerInput.requestEnvelope.context.System.user;
        if(!await isAuthenticated(accessToken, handlerInput)){
            return handlerInput.responseBuilder
                .speak("You must link your account in the Alexa App before you can do that.")
                .withLinkAccountCard()
                .getResponse();
        }
        
        // Check that there is an active workout
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(Object.keys(attributes).length === 0 || attributes.activeWorkout === undefined){
            return handlerInput.responseBuilder
                .speak("You must start a workout before doing that. To start todays workout, say 'Start workout'.")
                .reprompt("To start todays workout, say 'Start workout'.")
                .getResponse(); 
        }
        
        try{    
            // Get the next exercise
            const exerciseResult = await httpReq(DATABASE_URL + "/workout/" + attributes.activeWorkout + "/" + (attributes.exerciseIndex + 1) + "/" + attributes.email, DEFAULT_OPTIONS);
            const exerciseResultJson = JSON.parse(exerciseResult);
            
            let speakOutput = null;
            if(Object.keys(exerciseResultJson).length > 0){
                // Save the new exercise
                attributes.exerciseIndex = attributes.exerciseIndex + 1;
                attributes.activeExerciseName = exerciseResultJson[0].name;
                attributes.activeExerciseSets = exerciseResultJson[0].set_count;
                attributes.activeExerciseReps = exerciseResultJson[0].rep_count;
                attributes.activeExerciseWeight = exerciseResultJson[0].weight;
                handlerInput.attributesManager.setPersistentAttributes(attributes);
                handlerInput.attributesManager.savePersistentAttributes();
                
                speakOutput = "Exercise skipped. Your next exercise is " + exerciseResultJson[0].name + ". Do " + exerciseResultJson[0].set_count + " sets of " + exerciseResultJson[0].rep_count + " with " + exerciseResultJson[0].weight + " pounds.";
            }
            else{
                speakOutput = "Exercise skipped. You have completed your " + attributes.activeWorkout + ". Great work!";
                
                // Clean database
                attributes.activeWorkout = undefined;
                attributes.exerciseIndex = undefined;
                attributes.activeExerciseName = undefined;
                attributes.activeExerciseSets = undefined;
                attributes.activeExerciseReps = undefined;
                attributes.activeExerciseWeight = undefined;
                handlerInput.attributesManager.setPersistentAttributes(attributes);
                handlerInput.attributesManager.savePersistentAttributes();
            }
            
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        }
        catch(error){
            return handlerInput.responseBuilder
                .speak("Sorry, unable to access database at this time. Please try again later.")
                .getResponse();
        }
    }
};

/**
 * Returns to the previous exercise in the active workout
 */
const PreviousExerciseHandler = {
    canHandle(handlerInput){
        const request = handlerInput.requestEnvelope.request;
        return request.type === "IntentRequest" && request.intent.name === "PreviousExerciseIntent";
    },
    async handle(handlerInput){
        // Check that the user has linked their account
        const { accessToken } = handlerInput.requestEnvelope.context.System.user;
        if(!await isAuthenticated(accessToken, handlerInput)){
            return handlerInput.responseBuilder
                .speak("You must link your account in the Alexa App before you can do that.")
                .withLinkAccountCard()
                .getResponse();
        }
        
        // Check that there is an active workout
        const attributes = await handlerInput.attributesManager.getPersistentAttributes();
        if(Object.keys(attributes).length === 0 || attributes.activeWorkout === undefined){
            return handlerInput.responseBuilder
                .speak("You must start a workout before doing that. To start todays workout, say 'Start workout'.")
                .reprompt("To start todays workout, say 'Start workout'.")
                .getResponse(); 
        }
        
        // Check that there is a previous exercise
        if(attributes.exerciseIndex === 0){
            return handlerInput.responseBuilder
                .speak("Can't go back, this is your first exercise.")
                .getResponse();
        }
            
        try{    
            // Get the next exercise
            const exerciseResult = await httpReq(DATABASE_URL + "/workout/" + attributes.activeWorkout + "/" + (attributes.exerciseIndex - 1) + "/" + attributes.email, DEFAULT_OPTIONS);
            const exerciseResultJson = JSON.parse(exerciseResult);
    
            // Save the new exercise
            attributes.exerciseIndex = attributes.exerciseIndex - 1;
            attributes.activeExerciseName = exerciseResultJson[0].name;
            attributes.activeExerciseSets = exerciseResultJson[0].set_count;
            attributes.activeExerciseReps = exerciseResultJson[0].rep_count;
            attributes.activeExerciseWeight = exerciseResultJson[0].weight;
            handlerInput.attributesManager.setPersistentAttributes(attributes);
            handlerInput.attributesManager.savePersistentAttributes();
            
            const speakOutput = "Your next exercise is " + exerciseResultJson[0].name + ". Do " + exerciseResultJson[0].set_count + " sets of " + exerciseResultJson[0].rep_count + " with " + exerciseResultJson[0].weight + " pounds.";
        
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        }
        catch(error){
            return handlerInput.responseBuilder
                .speak("Sorry, unable to access database at this time. Please try again later.")
                .getResponse();
        }
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log("Error: " + String(error));
            
        const speakOutput = "Sorry, I wasn't able to process that request. What would you like to do?";
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
        }
};

const skillBuilder = Alexa.SkillBuilders.standard();

exports.handler = skillBuilder
  .addRequestHandlers(LaunchRequestHandler, HelpHandler, StartWorkoutHandler, NextExerciseHandler, AdjustWeightHandler, GetExerciseHandler, EndWorkoutHandler, GetSetsHandler, GetWeightHandler, SkipExerciseHandler, PreviousExerciseHandler, CancelHandler)
  .addErrorHandlers(ErrorHandler)
  .withTableName("WorkoutTrackerTable")
  .withAutoCreateTable(true)
  .lambda();