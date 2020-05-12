// True when the save button is enabled
var saveEnabled = false;

/*
 * Add a new exercise to the active workout
 */
function addExercise() {
    // Get the new exercise
    var name = $("#exerciseToAdd option:selected").attr("data-eName");
    var sets = $("#exerciseToAdd option:selected").attr("data-eSets");
    var reps = $("#exerciseToAdd option:selected").attr("data-eReps");
    var weight = $("#exerciseToAdd option:selected").attr("data-eWeight");
    var muscleGroup = $("#exerciseToAdd option:selected").attr("data-eMuscleGroup");

    // Create the new html elements 
    var tRow = document.createElement("tr");
    var nameData = document.createElement("td");
    nameData.innerHTML = name;
    var setData = document.createElement("td");
    setData.innerHTML = sets;
    var repData = document.createElement("td");
    repData.innerHTML = reps;
    var weightData = document.createElement("td");
    weightData.innerHTML = weight;
    var muscleGroupData = document.createElement("td");
    muscleGroupData.innerHTML = muscleGroup;
    var removeBtn = document.createElement("a");
    removeBtn.href = "#";
    removeBtn.className = "btn btn-link float-right remove-exercise";
    removeBtn.onclick = function () {
        tRow.remove();
        enableSave();
    }
    var removeImg = document.createElement("i");
    removeImg.className = "fas fa-trash";

    // Add the new html elements
    tRow.appendChild(nameData);
    tRow.appendChild(setData);
    tRow.appendChild(repData);
    tRow.appendChild(weightData);
    removeBtn.appendChild(removeImg);
    muscleGroupData.appendChild(removeBtn);
    tRow.appendChild(muscleGroupData);

    document.getElementById("exerciseBody").appendChild(tRow);

    enableSave();
}

/*
 * Saves the active workout
 * @param previousName - Previous name of the active workout
 */
function saveWorkout(previousName) {
    // Get the exercises
    var exerciseTable = document.getElementById("exerciseTable");
    var exercises = new Array(exerciseTable.rows.length - 1);
    for (var i = 1; i < exerciseTable.rows.length; i++) {
        exercises[i - 1] = exerciseTable.rows.item(i).cells.item(0).innerHTML;
    }

    // Build the workout data
    var workoutData = {};
    workoutData["name"] = document.getElementById("workoutName").value;
    workoutData["exercises"] = exercises;
    workoutData["previousName"] = previousName;
    workoutData["user_email"] = " ";

    // Have the server save the workout
    $.ajax({
        url: "SaveWorkout",
        type: "POST",
        data: JSON.stringify(workoutData),
        contentType: "application/json"
    })

    // Disable the save button
    document.getElementById("saveWorkoutBtn").className = "btn btn-primary float-right disabled";
    document.getElementById("saveWorkoutBtn").innerHTML = "<i class=\"fas fa-check mr-1\"></i>Saved";
    saveEnabled = false;
}

/*
 * Enables the save button
 */ 
function enableSave() {
    if (!saveEnabled) {
        document.getElementById("saveWorkoutBtn").className = "btn btn-primary float-right";
        document.getElementById("saveWorkoutBtn").innerHTML = "<i class=\"fas fa-save mr-1\"></i>Save";
        saveEnabled = true;
    }
}