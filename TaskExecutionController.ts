import { Queue, Worker, Job } from 'bullmq';
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext';
import { v4 as uuidv4 } from 'uuid';

type Task = {
  name: string;
  taskReferenceName: string;
  type: string;
  inputParameters: Record<string, any>;
  retryCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
};

type WorkflowDetails = {
  name: string;
  status: 'RUNNING' | 'COMPLETED';
  workflowId: string;
  description: string;
  tasks: Task[];
};

const redisConnection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
};

const queueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      age: 24 * 3600 * 30,
      count: 5000,
    },
    removeOnFail: {
      age: 24 * 3600 * 30,
      count: 5000,
    },
  },
};

const queue = new Queue('task-queue', queueOptions);

const workFlowDetails: WorkflowDetails = {
  name: 'aira_orchestrator',
  status: 'RUNNING',
  workflowId: '31a6fc15-b42f-46a9-abb1-117a9a500e61',
  description: 'orchestrator testing',
  tasks: [
    {
      name: 'sendEmail',
      taskReferenceName: '670badea-fd8f-455b-917a-79d6e9956241',
      type: 'SIMPLE',
      inputParameters: {
        connection: 'EYTK0FPX8M4HUS5JJ2VTPKUZ8OMGLWWN',
        recipient_type: 'value',
        recipients: '$$applicantEmail$$',
        cc: null,
        subject: '$$templateResult.subject$$',
        template: 'N8DK1K4UVLLQLYVZB48NVFXQJQY06Z36',
        file: null,
      },
      retryCount: 1,
      status: 'PENDING',
    },
    {
      name: 'FORM',
      taskReferenceName: '5ddaf747-5e45-41e9-8149-7e768a3d7c1f',
      type: 'HUMAN',
      inputParameters: {
        first_name: null,
        last_name: null,
      },
      retryCount: 1,
      status: 'PENDING',
    },
    {
      name: 'CREATE_GOOGLE_SHEET',
      taskReferenceName: '6865f673-1d6f-442d-b008-a6fb249f5846',
      type: 'SIMPLE',
      inputParameters: {
        connection: '2UPBF5SIHKMMHEZ01OKGVLBRZMH69ZT6',
        sheetname: '${workflow.variables.first_name}',
      },
      retryCount: 1,
      status: 'PENDING',
    },
  ],
};

const workflowMemory: { tasks: Task[] } = { tasks: [...workFlowDetails.tasks] };
let taskMemory: Task | null = null;
export default class WorkflowsController {
  async startWorkflow({ response }: HttpContextContract) {
    try {
      const jobCount = await queue.getJobCountByTypes('waiting', 'active', 'delayed');
      if (jobCount === 0) {
        const firstTask = workflowMemory.tasks.find((task) => task.status === 'PENDING');
        console.log('----firstTask',firstTask);
        if (firstTask) {
          firstTask.status = 'IN_PROGRESS';
          taskMemory = { ...firstTask };
          await queue.add(firstTask.name, { taskData: firstTask,workflowId: workFlowDetails.workflowId });
          console.log(`First task ${firstTask.name} added to queue.`);
        } else {
          console.log('No tasks to add to the queue.');
        }
      }
      // Another way to fetch jobs from queue by workflow id;
      const activeJobs = await this.getJobsByWorkflowId(workFlowDetails.workflowId);
      console.log('Active Jobs for Workflow:', activeJobs);
      return;
      await this.startQueueWorkerConsumer();
      response.status(200).json({ message: 'Workflow started successfully' });
    } catch (error) {
      response.status(500).json({ message: 'Failed to start workflow', error: error.message });
    }
  }

  async getJobsByWorkflowId(workflowId: string) {
    const jobs = await queue.getJobs(['active', 'delayed', 'waiting']);
    const filteredJobs = jobs.filter((job) => job.data.workflowId === workflowId);
    return filteredJobs;
  }

  async startQueueWorkerConsumer() {
    const worker = new Worker(
      'task-queue',
      async (job: Job) => {
        try {
          const taskData: Task = job.data.taskData;
          console.log(`Processing task: ${taskData.name}`);
          await this.taskExecution(taskData);

          // Update taskMemory and workflowMemory
          if (taskMemory && taskMemory.taskReferenceName === taskData.taskReferenceName) {
            taskMemory.status = 'COMPLETED';
            const completedTask = workflowMemory.tasks.find((task) => task.taskReferenceName === taskData.taskReferenceName);
            if (completedTask) {
              completedTask.status = 'COMPLETED';
            }
          }
          console.log(`Task ${taskData.name} completed.`);
          await this.processNextTask();
        } catch (error) {
          console.error(`Error processing task: ${error.message}`);
          throw error;
        }
      },
      queueOptions
    );

    worker.on('completed', (job: Job) => {
      console.log(`Job ${job.id} completed successfully.`);
    });

    worker.on('failed', (job: Job, err: Error) => {
      console.log(`Job ${job.id} failed with error: ${err.message}`);
    });
  }

  async processNextTask() {
    const pendingTask = workflowMemory.tasks.find((task) => task.status === 'PENDING');
    if (pendingTask) {
      pendingTask.status = 'IN_PROGRESS';
      taskMemory = { ...pendingTask };
      await queue.add(pendingTask.name, { taskData: pendingTask, workflowId: workFlowDetails.workflowId });
      console.log(`Task ${pendingTask.name} added to queue.`);
      console.log('-----taskMemory',taskMemory);
    } else {
      console.log('All tasks completed.');
      workFlowDetails.status = 'COMPLETED';
      console.log('-----workFlowDetails',workFlowDetails);
    }
  }

  async taskExecution(taskData: Task) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Task ${taskData.name} execution started.`);
        resolve(true);
      }, 2000);
    });
  }
}
