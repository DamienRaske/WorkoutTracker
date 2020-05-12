/*
 * Saves the user's routine
 */
function routineFormSubmit() {
    // Build the routine data model
    var routineFormArray = $("#routineForm").serializeArray();
    var routineData = {};
    for (i = 0; i < routineFormArray.length; i++) {
        routineData[routineFormArray[i].name] = routineFormArray[i].value;
    }
    routineData["user_email"] = null;

    // Ask the server to save the routine
    $.ajax({
        url: "SaveRoutine",
        type: "POST",
        data: JSON.stringify(routineData),
        contentType: "application/json"
    })
    .done(function (partialView) {
        $("#alerts").html(partialView);
        document.getElementById("saveBtn").className = "btn btn-primary float-right disabled";
        document.getElementById("saveBtn").innerHTML = "<i class=\"fas fa-check mr-1\"></i>Saved";
    });
}

document.getElementById("saveBtn").onclick = function () {
    routineFormSubmit();
};

// Enable save button when the form is changed
var elements = document.getElementsByTagName("select");
for (i = 0; i < elements.length; i++) {
    elements[i].onchange = function () {
        document.getElementById("saveBtn").className = "btn btn-primary float-right";
        document.getElementById("saveBtn").innerHTML = "<i class=\"fas fa-save mr-1\"></i>Save";
    }
}