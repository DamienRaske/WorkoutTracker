// Set first workout as the selected workout
var selectedWorkout = document.getElementsByClassName("list-group-item")[0].id;

/*
 * Gets the details of a workout
 */
function getWorkoutDetails() {
    $.ajax({
        url: "WorkoutDetails",
        type: "POST",
        data: { "workoutName": selectedWorkout }
    })
    .done(function (partialView) {
        $("#workoutDetails").html(partialView);
    });
}

/*
 * Sets a given workout as the selected workout
 * @param workout - The new selected workout
 */
function setSelectedWorkout(workout) {
    if (document.getElementById(selectedWorkout) != null) {
        document.getElementById(selectedWorkout).style = "background-color: #fff; color: #0366d6";
    }
    document.getElementById(workout).style = "background-color: #337ab7; color: #fff";
    selectedWorkout = workout;
    getWorkoutDetails();
}

/*
 * Deletes a workout
 */
function deleteWorkout() {
    // Get the workout that should be deleted
    var workoutToDelete = document.getElementById("workoutToDelete").value;

    // Ask the server to delete the workout
    $.ajax({
        url: "DeleteWorkout",
        type: "POST",
        data: { "workoutName": workoutToDelete }
    })

    document.getElementById(workoutToDelete).remove();
    document.getElementById("delete " + workoutToDelete).remove();

    setSelectedWorkout(document.getElementsByClassName("list-group-item")[0].id);
}

document.getElementById("deleteWorkoutBtn").onclick = function () {
    deleteWorkout();
}

/*
 * Creates a new workout
 */
function createWorkout() {
    // Get the name of the new workout
    var newWorkoutName = document.getElementById("newWorkoutName").value;
    document.getElementById("newWorkoutName").value = "";

    // Ask the server to create the workout
    $.ajax({
        url: "CreateWorkout",
        type: "POST",
        data: { "workoutName": newWorkoutName }
    })

    // Add to workout list
    var listItem = document.createElement("a");
    listItem.href = "#";
    listItem.className = "list-group-item"
    listItem.id = newWorkoutName;
    listItem.innerHTML = newWorkoutName;
    listItem.onclick = function () {
        setSelectedWorkout(newWorkoutName);
    }
    document.getElementById("workoutList").appendChild(listItem);

    // Add to delete Modal
    var modalItem = document.createElement("option");
    modalItem.value = newWorkoutName;
    modalItem.id = "delete " + newWorkoutName;
    modalItem.innerHTML = newWorkoutName;
    document.getElementById("workoutToDelete").appendChild(modalItem);
}

document.getElementById("createWorkoutBtn").onclick = function (event) {
    createWorkout();
}

window.onload = function () {
    this.getWorkoutDetails();
};