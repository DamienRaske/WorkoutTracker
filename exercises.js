/*
 * Create a new exercise
 */
function createExercise() {
    // Build the exercise data
    var exerciseData = {};
    exerciseData["name"] = document.getElementById("newExerciseName").value;
    exerciseData["set_count"] = parseInt(document.getElementById("newExerciseSetCount").value, 10);
    exerciseData["rep_count"] = parseInt(document.getElementById("newExerciseRepCount").value, 10);
    exerciseData["weight"] = parseInt(document.getElementById("newExerciseWeight").value, 10);
    exerciseData["muscle_group"] = document.getElementById("newExerciseMuscleGroup").value;
    exerciseData["previous_name"] = " ";
    exerciseData["user_email"] = " ";

    // Reset form fields
    document.getElementById("newExerciseName").value = "";
    document.getElementById("newExerciseSetCount").value = "";
    document.getElementById("newExerciseRepCount").value = "";
    document.getElementById("newExerciseWeight").value = "";
    document.getElementById("newExerciseMuscleGroup").selectedIndex = 0;

    // Clean the name
    var cleanName = "";
    for (var i = 0; i < exerciseData["name"].length; i++) {
        if (exerciseData["name"][i] != " ") {
            cleanName += exerciseData["name"][i];
        }
    }

    // Create the new html element
    var element = document.getElementById("exerciseContainer").cloneNode(true);
    element.dataset.target = "#" + cleanName;
    element.querySelector("#exerciseTitle").innerHTML = exerciseData["name"];
    element.querySelector("#exerciseTitle").dataset.target = "#" + cleanName;
    element.querySelector("#arrow").dataset.target = "#" + cleanName;
    element.querySelector(".collapse").id = cleanName;
    element.querySelector("#nameInput").value = exerciseData["name"];
    element.querySelector("#setCountInput").value = exerciseData["set_count"];
    element.querySelector("#repCountInput").value = exerciseData["rep_count"];
    element.querySelector("#weightInput").value = exerciseData["weight"];
    element.querySelector("#muscleGroupInput").value = exerciseData["muscle_group"];
    element.querySelector("#deleteBtn").onclick = function () {
        deleteExercise(exerciseData["name"], cleanName);
    }
    element.querySelector("#saveBtn").onclick = function () {
        saveExercise(exerciseData["name"], cleanName);
    }
    element.querySelector("#viewProgressionBtn").onclick = function () {
        showExerciseProgression(exerciseData["name"]);
    }

    // Update collapsable elements
    $(element.querySelector(".collapse")).on("show.bs.collapse", function (event) {
        $(this).parent().find("#arrow").removeClass("fa-chevron-down");
        $(this).parent().find("#arrow").addClass("fa-chevron-up");

        $(this).parent().removeAttr("data-toggle");
        $(this).parent().find("#exerciseTitle").attr("data-toggle", "collapse");
        $(this).parent().find("#arrow").attr("data-toggle", "collapse");
    });

    $(element.querySelector(".collapse")).on("hide.bs.collapse", function (event) {
        $(this).parent().find("#arrow").removeClass("fa-chevron-up");
        $(this).parent().find("#arrow").addClass("fa-chevron-down");

        $(this).parent().find("#exerciseTitle").removeAttr("data-toggle");
        $(this).parent().attr("data-toggle", "collapse");
        $(this).parent().find("#arrow").removeAttr("data-toggle");
    });

    $(element.querySelectorAll(".form-control")).on("focus", function () {
        $(this).parent().parent().parent().parent().parent().find("#saveBtn").removeClass("disabled");
        $(this).parent().parent().parent().parent().parent().find("#saveBtn").html("<i class=\"fas fa-save mr-1\"></i>Save");
    });

    document.getElementById("ExercisesForm").appendChild(element);

    // Have the server create the exercise
    $.ajax({
        url: "CreateExercise",
        type: "POST",
        data: JSON.stringify(exerciseData),
        contentType: "application/json"
    })
}

document.getElementById("createExerciseBtn").onclick = function () {
    createExercise();
}

/*
 * Delete a given exercise
 * @param exerciseName - The name of the exercise to delete. Used by the server to find the exercise
 * @param cleanName - The clean name of the exercise to delete. Used by the client to find the html element
 */
function deleteExercise(exerciseName, cleanName) {
    document.getElementById(cleanName).parentElement.remove();

    $.ajax({
        url: "DeleteExercise",
        type: "POST",
        data: { "exerciseName": exerciseName}
    })
}

/*
 * Saves a given exercise
 * @param exerciseName - The name of the exercise to save. Used by the server to find the exercise
 * @param cleanName - The clean name of the exercise to save. Used by the client to find the html element
 */
function saveExercise(previousExerciseName, cleanName) {
    var container = document.getElementById(cleanName);

    // Build exercise data model
    var exerciseData = {};
    exerciseData["name"] = container.querySelector("#nameInput").value;
    exerciseData["set_count"] = parseInt(container.querySelector("#setCountInput").value, 10);
    exerciseData["rep_count"] = parseInt(container.querySelector("#repCountInput").value, 10);
    exerciseData["weight"] = parseInt(container.querySelector("#weightInput").value, 10);
    exerciseData["muscle_group"] = container.querySelector("#muscleGroupInput").value;
    exerciseData["previous_name"] = previousExerciseName;
    exerciseData["user_email"] = " ";

    // Clean the new name
    var newCleanName = "";
    for (var i = 0; i < exerciseData["name"].length; i++) {
        if (exerciseData["name"][i] != " ") {
            newCleanName += exerciseData["name"][i];
        }
    }

    // Update UI
    container.parentElement.querySelector("#exerciseTitle").innerHTML = exerciseData["name"];
    container.dataset.target = "#" + newCleanName;
    container.setAttribute("id", newCleanName);
    container.querySelector("#saveBtn").onclick = function () {
        saveExercise(exerciseData["name"], newCleanName);
    }
    container.querySelector("#deleteBtn").onclick = function () {
        deleteExercise(exerciseData["name"], newCleanName);
    }
    container.querySelector("#saveBtn").className = "btn btn-primary float-right prevent-collapse disabled";
    container.querySelector("#saveBtn").innerHTML = "<i class=\"fas fa-check mr-1\"></i>Saved";

    // Send save request to the server
    $.ajax({
        url: "SaveExercise",
        type: "POST",
        data: JSON.stringify(exerciseData),
        contentType: "application/json"
    })
}

/*
 * Shows the progression of a given exercise
 * @param exerciseName - The name of the exercise to show the progression of
 */
function showExerciseProgression(exerciseName) {
    $.ajax({
        url: "ExerciseProgression",
        type: "POST",
        data: { "exerciseName": exerciseName }
    })
    .done(function (partialView) {
        $("#exerciseProgressionModalBody").html(partialView);
        $("#exerciseProgressionModal").modal()
    });
}

window.onload = function () {
    $(".collapse").on("show.bs.collapse", function (event) {
        $(this).parent().find("#arrow").removeClass("fa-chevron-down");
        $(this).parent().find("#arrow").addClass("fa-chevron-up");

        $(this).parent().removeAttr("data-toggle");
        $(this).parent().find("#exerciseTitle").attr("data-toggle", "collapse");
        $(this).parent().find("#arrow").attr("data-toggle", "collapse");
    });

    $(".collapse").on("hide.bs.collapse", function (event) {
        $(this).parent().find("#arrow").removeClass("fa-chevron-up");
        $(this).parent().find("#arrow").addClass("fa-chevron-down");

        $(this).parent().find("#exerciseTitle").removeAttr("data-toggle");
        $(this).parent().attr("data-toggle", "collapse");
        $(this).parent().find("#arrow").removeAttr("data-toggle");
    });

    $(".prevent-collapse").on("click", function (event) {
        event.stopPropagation();
    });

    $(".form-control").on("focus", function () {
        $(this).parent().parent().parent().parent().parent().find("#saveBtn").removeClass("disabled");
        $(this).parent().parent().parent().parent().parent().find("#saveBtn").html("<i class=\"fas fa-save mr-1\"></i>Save");
    });

    $("#exerciseProgressionModal").on("hide.bs.modal", function (event) {
        document.getElementById("exerciseProgressionModalBody").innerHTML = " ";
    });
};