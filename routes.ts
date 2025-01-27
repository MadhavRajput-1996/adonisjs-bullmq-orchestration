Route.post("api/v1/testqueue/add-bulk-tasks", "TestQueueWorker.addBulkTasks");
Route.get("api/v1/testqueue/start-worker", "TestQueueWorker.startWorker");
Route.get("api/v1/testqueue/job-count", "TestQueueWorker.getQueueJobData");
Route.get("api/v1/testqueue/fetchAllTasks", "TestQueueWorker.fetchTasksFromConductor");
Route.post("api/v1/testqueue/delete-queue", "TestQueueWorker.emptyQueue");
Route.get("api/v1/start/taskexecution", "TaskExecutionController.startWorkflow")
