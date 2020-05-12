using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using WorkoutTrackerWebApplication.Models;
using Microsoft.AspNetCore.Authorization;

using Microsoft.AspNetCore.Authentication;
using System.Net.Http;
using System.Net.Http.Headers;
using Newtonsoft.Json;

namespace WorkoutTrackerWebApplication.Controllers
{
    public class HomeController : Controller
    {
        static readonly HttpClient httpClient = new HttpClient();
        private readonly ILogger<HomeController> _logger;

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;

            //Set authorization header
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "gjT0EsKnxSwmiG6nVl9w06b4cxnF0gvW8lOVPmITXI3R");
        }

        public IActionResult Index()
        {
            return View();
        }

        /*
         * Generates the user's routine page
         * @return The routine view and corresponding model
         */
        public async Task<IActionResult> Routine()
        {
            if (!User.Identity.IsAuthenticated)
            {
                return RedirectToAction("Login");
            }
            else
            {
                RoutineModel routineModel = new RoutineModel();

                // Get the user's workouts from the database
                string userEmail = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
                HttpResponseMessage res = await httpClient.GetAsync("http://localhost:8080/workouts/" + userEmail);

                // Add the user's workouts to the data model
                string workoutStr = await res.Content.ReadAsStringAsync();
                dynamic workoutJson = JsonConvert.DeserializeObject(workoutStr);
                string[] workouts = new string[workoutJson.Count + 1];
                for(int i = 0; i < workoutJson.Count; i++)
                {
                    workouts[i] = workoutJson[i]["name"];
                }
                workouts[workoutJson.Count] = "--";

                routineModel.workouts = workouts;

                // Get the user's routine from the database
                res = await httpClient.GetAsync("http://localhost:8080/routine/" + userEmail);

                // Add the user's routine to the data model
                string routineStr = await res.Content.ReadAsStringAsync();
                dynamic routineJson = JsonConvert.DeserializeObject(routineStr);
                for(int i = 0; i < routineJson.Count; i++)
                {
                    switch (Convert.ToString(routineJson[i]["day"]))
                    {
                        case "Sunday":
                            routineModel.sunday = routineJson[i]["workout_name"];
                            break;
                        case "Monday":
                            routineModel.monday = routineJson[i]["workout_name"];
                            break;
                        case "Tuesday":
                            routineModel.tuesday = routineJson[i]["workout_name"];
                            break;
                        case "Wednesday":
                            routineModel.wednesday = routineJson[i]["workout_name"];
                            break;
                        case "Thursday":
                            routineModel.thursday = routineJson[i]["workout_name"];
                            break;
                        case "Friday":
                            routineModel.friday = routineJson[i]["workout_name"];
                            break;
                        case "Saturday":
                            routineModel.saturday = routineJson[i]["workout_name"];
                            break;
                    }
                }

                return View("Routine", routineModel);
            }
        }
       
        /*
         * Saves the user's routine
         * @param routineFormModel - The data model to be saved
         * @return Partial view containing alerts about the routine
         */
        [HttpPost]
        public async Task<PartialViewResult> SaveRoutine([FromBody] RoutineFormModel routineFormModel)
        {
            routineFormModel.cleanDays();

            // Update the user's routine in the database
            string userEmail = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            routineFormModel.user_email = userEmail;
            string bodyContent = JsonConvert.SerializeObject(routineFormModel);
            await httpClient.PostAsync("http://localhost:8080/routine/update", new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json"));

            // Get the muscle groups worked by the user's routine from the database
            HttpResponseMessage res = await httpClient.GetAsync("http://localhost:8080/routine/" + userEmail + "/muscleGroups");

            // Add muscle groups to a hash set array. Each indice in the array representing one day of the week
            string muscleGroupStr = await res.Content.ReadAsStringAsync();
            dynamic muscleGroupJson = JsonConvert.DeserializeObject(muscleGroupStr);
            HashSet<string>[] muscleGroupRoutine = new HashSet<string>[7];
            for(int i = 0; i < muscleGroupRoutine.Length; i++)
            {
                muscleGroupRoutine[i] = new HashSet<string>();
            }
            for(int i = 0; i < muscleGroupJson.Count; i++)
            {
                switch (Convert.ToString(muscleGroupJson[i]["day"]))
                {
                    case "Sunday":
                        muscleGroupRoutine[0].Add(Convert.ToString(muscleGroupJson[i]["muscle_group"]));
                        break;
                    case "Monday":
                        muscleGroupRoutine[1].Add(Convert.ToString(muscleGroupJson[i]["muscle_group"]));
                        break;
                    case "Tuesday":
                        muscleGroupRoutine[2].Add(Convert.ToString(muscleGroupJson[i]["muscle_group"]));
                        break;
                    case "Wednesday":
                        muscleGroupRoutine[3].Add(Convert.ToString(muscleGroupJson[i]["muscle_group"]));
                        break;
                    case "Thursday":
                        muscleGroupRoutine[4].Add(Convert.ToString(muscleGroupJson[i]["muscle_group"]));
                        break;
                    case "Friday":
                        muscleGroupRoutine[5].Add(Convert.ToString(muscleGroupJson[i]["muscle_group"]));
                        break;
                    case "Saturday":
                        muscleGroupRoutine[6].Add(Convert.ToString(muscleGroupJson[i]["muscle_group"]));
                        break;
                }
            }

            // Build strings of over and under worked muscle groups
            string underworkedMuscleGroups = "";
            string overworkedMuscleGroups = "";
            string[] muscleGroupOptions = { "Chest", "Back", "Arms", "Shoulders", "Legs", "Calves" };
            foreach(string muscleGroup in muscleGroupOptions)
            {
                int count = 0;
                bool repeated = false;

                //Check if a muscle group is worked two days in a row
                string previous = null;
                foreach (HashSet<string> set in muscleGroupRoutine)
                {
                    if (set.Contains(muscleGroup))
                    {
                        count++;
                        if (previous == muscleGroup) {
                            repeated = true; 
                        }
                        previous = muscleGroup;
                    }
                    else
                    {
                        previous = null;
                    }
                }

                //Check if a muscle group is worked more or less than two times in a routine
                if(count < 2)
                {
                    if(underworkedMuscleGroups.Length > 0)
                    {
                        underworkedMuscleGroups += ", ";
                    }
                    underworkedMuscleGroups += muscleGroup;
                }
                else if (count > 2 || repeated)
                {
                    if (overworkedMuscleGroups.Length > 0)
                    {
                        overworkedMuscleGroups += ", ";
                    }
                    overworkedMuscleGroups += muscleGroup;
                }
            }

            // Build routine alerts model
            RoutineAlertsModel routineAlertsModel = new RoutineAlertsModel();
            routineAlertsModel.underworkedMuscleGroups = underworkedMuscleGroups;
            routineAlertsModel.overworkedMuscleGroups = overworkedMuscleGroups;

            return PartialView("_RoutineAlertsPartial", routineAlertsModel);
        }

        /*
         * Generates the user's workout page
         * @return The workout view and model
         */
        [HttpGet]
        public async Task<IActionResult> Workouts()
        {
            if (!User.Identity.IsAuthenticated)
            {
                return RedirectToAction("Login");
            }
            else
            {
                WorkoutsModel workoutsModel = new WorkoutsModel();

                // Get the user's workouts from the database
                string userEmail = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
                HttpResponseMessage res = await httpClient.GetAsync("http://localhost:8080/workouts/" + userEmail);

                // Add the user's workouts to the data model
                string workoutStr = await res.Content.ReadAsStringAsync();
                dynamic workoutJson = JsonConvert.DeserializeObject(workoutStr);
                string[] workouts = new string[workoutJson.Count];
                for (int i = 0; i < workoutJson.Count; i++)
                {
                    workouts[i] = workoutJson[i]["name"];
                }

                workoutsModel.workouts = workouts;
                workoutsModel.selectedWorkout = workouts.Length > 0 ? workouts[0] : null;

                return View("Workouts", workoutsModel);
            }
        }

        /*
         * Returns the details of the user's workout
         * @param workoutName - The name of the workout to get the details of
         * @return Partial view containing the workout's exercises
         */
        [HttpPost]
        public async Task<PartialViewResult> WorkoutDetails(string workoutName)
        {
            // Get the exercises that are involved in the given workout from the database
            string userEmail = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            HttpResponseMessage res = await httpClient.GetAsync("http://localhost:8080/workoutDetails/" + workoutName + "/" + userEmail);

            // Add the exercises to the data model
            string exercisesStr = await res.Content.ReadAsStringAsync();
            dynamic exercisesJson = JsonConvert.DeserializeObject(exercisesStr);
            WorkoutDetailsModel workoutDetailsModel = new WorkoutDetailsModel();
            for (int i = 0; i < exercisesJson.Count; i++)
            {
                ExerciseModel exerciseModel = new ExerciseModel();
                exerciseModel.name = exercisesJson[i]["name"];
                exerciseModel.set_count = exercisesJson[i]["set_count"];
                exerciseModel.rep_count = exercisesJson[i]["rep_count"];
                exerciseModel.weight = exercisesJson[i]["weight"];
                exerciseModel.muscle_group = exercisesJson[i]["muscle_group"];
                workoutDetailsModel.workoutExercises.Add(exerciseModel);
            }

            // Get all of the user's exercises
            res = await httpClient.GetAsync("http://localhost:8080/exercises/" + userEmail);

            // Add all of the user's exercises to the data model
            ICollection<ExerciseModel> exercisesModel = new List<ExerciseModel>();
            exercisesStr = await res.Content.ReadAsStringAsync();
            exercisesJson = JsonConvert.DeserializeObject(exercisesStr);
            for (int i = 0; i < exercisesJson.Count; i++)
            {
                ExerciseModel exerciseModel = new ExerciseModel();
                exerciseModel.name = exercisesJson[i]["name"];
                exerciseModel.set_count = Convert.ToInt32(exercisesJson[i]["set_count"]);
                exerciseModel.rep_count = Convert.ToInt32(exercisesJson[i]["rep_count"]);
                exerciseModel.weight = Convert.ToInt32(exercisesJson[i]["weight"]);
                exerciseModel.muscle_group = exercisesJson[i]["muscle_group"];
                workoutDetailsModel.exercises.Add(exerciseModel);
            }

            workoutDetailsModel.name = workoutName;

            return PartialView("_WorkoutDetailsPartial", workoutDetailsModel);
        }

        /*
         * Deletes the given workout
         * @param workoutName - The name of the workout that will be deleted
         */
        [HttpPost]
        public async void DeleteWorkout(string workoutName)
        {
            string userEmail = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            string bodyContent = "{\"user_email\": \"" + userEmail + "\"}";
            await httpClient.PostAsync("http://localhost:8080/workout/delete/" + workoutName, new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json"));
        }

        /*
         * Creates a new workout
         * @param workoutName - The name of the new workout
         */ 
        [HttpPost]
        public async void CreateWorkout(string workoutName)
        {
            string userEmail = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            string bodyContent = "{\"user_email\": \"" + userEmail + "\",\"name\": \"" + workoutName + "\"}";
            await httpClient.PostAsync("http://localhost:8080/workout/create", new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json"));
        }

        /*
         * Saves a workout
         * @param saveExerciseFormModel - Model containing the data needed to save a workout 
         */
        [HttpPost]
        public async void SaveWorkout([FromBody] SaveExerciseFormModel saveExerciseFormModel)
        {
            saveExerciseFormModel.user_email = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            string bodyContent = JsonConvert.SerializeObject(saveExerciseFormModel);
            await httpClient.PostAsync("http://localhost:8080/workout/save", new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json"));
        }

        /*
         * Generates the user's exercises page
         * @return Exercises page view and model
         */
        public async Task<IActionResult> Exercises()
        {
            if (!User.Identity.IsAuthenticated)
            {
                return RedirectToAction("Login");
            }
            else
            {
                // Get all of the user's exercises from the database
                string userEmail = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
                HttpResponseMessage res = await httpClient.GetAsync("http://localhost:8080/exercises/" + userEmail);

                // Add all of the user's exercises to the data model
                ICollection<ExerciseModel> exercisesModel = new List<ExerciseModel>();
                string exercisesStr = await res.Content.ReadAsStringAsync();
                dynamic exercisesJson = JsonConvert.DeserializeObject(exercisesStr);
                for (int i = 0; i < exercisesJson.Count; i++)
                {
                    ExerciseModel exerciseModel = new ExerciseModel();
                    exerciseModel.name = exercisesJson[i]["name"];
                    exerciseModel.set_count = Convert.ToInt32(exercisesJson[i]["set_count"]);
                    exerciseModel.rep_count = Convert.ToInt32(exercisesJson[i]["rep_count"]);
                    exerciseModel.weight = Convert.ToInt32(exercisesJson[i]["weight"]);
                    exerciseModel.muscle_group = exercisesJson[i]["muscle_group"];
                    exercisesModel.Add(exerciseModel);
                }

                return View("Exercises", exercisesModel);
            }
        }

        /*
         * Creates a new exercise
         * @param exerciseFormModel - Model data used to create the new exercise
         */
        [HttpPost]
        public async void CreateExercise([FromBody] ExerciseFormModel exerciseFormModel)
        {
            exerciseFormModel.user_email = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            string bodyContent = JsonConvert.SerializeObject(exerciseFormModel);
            await httpClient.PostAsync("http://localhost:8080/exercise/create", new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json"));
        }

        /*
         * Deletes an exercise
         * @param exerciseName - The name of the exercise that will be deleted
         */
        [HttpPost]
        public async void DeleteExercise(string exerciseName)
        {
            string user_email = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            string bodyContent = "{\"user_email\": \"" + user_email + "\",\"name\": \"" + exerciseName + "\"}";
            await httpClient.PostAsync("http://localhost:8080/exercise/delete", new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json"));
        }

        /*
         * Saves an exercise
         * @param exerciseFormModel - Model data used to save/update the exercise
         */
        [HttpPost]
        public async void SaveExercise([FromBody] ExerciseFormModel exerciseFormModel)
        {
            string user_email = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            exerciseFormModel.user_email = user_email;
            string bodyContent = JsonConvert.SerializeObject(exerciseFormModel);
            await httpClient.PostAsync("http://localhost:8080/exercise/save", new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json"));
        }

        /*
         * Returns a partial view showing the user's exercise progression over time 
         * @param exerciseName - The name of the exercise to get the progression of
         * @return Exercise history partial view and model
         */
        public async Task<PartialViewResult> ExerciseProgression(string exerciseName)
        {
            // Get the history of a given exercise from the database
            string userEmail = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            HttpResponseMessage res = await httpClient.GetAsync("http://localhost:8080/exercise/" + exerciseName + "/history/" + userEmail);

            // Add the exercise history to the data model
            ICollection<ExerciseProgressionModel> exerciseHistory = new List<ExerciseProgressionModel>();
            string historyStr = await res.Content.ReadAsStringAsync();
            dynamic historyJson = JsonConvert.DeserializeObject(historyStr);
            for (int i = 0; i < historyJson.Count; i++)
            {
                ExerciseProgressionModel exerciseProgressionModel = new ExerciseProgressionModel();
                exerciseProgressionModel.date = historyJson[i]["date"];
                exerciseProgressionModel.weight = historyJson[i]["weight"];
                exerciseHistory.Add(exerciseProgressionModel);
            }

            return PartialView("_ExerciseProgressionPartial", exerciseHistory);
        }

        /*
         * Called after the user logs in using OAuth
         */
        [Authorize]
        public async Task<IActionResult> Login()
        {
            //Build body content
            string userEmail = User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress").Value;
            string userName = User.Identity.Name;
            string bodyContent = "{\"email\": \"" + userEmail + "\",\"name\": \"" + userName + "\"}";

            //Send request
            await httpClient.PostAsync("http://localhost:8080/new_user", new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json"));

            return RedirectToAction("Index");
        }

        /*
         * Logs the user out
         */
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync();

            return RedirectToAction("Index");
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
