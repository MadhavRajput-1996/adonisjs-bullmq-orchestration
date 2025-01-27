import { Queue, Worker, Job, MetricsTime } from 'bullmq';
const axios = require('axios');
import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
const redisConnection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  password:process.env.REDIS_PASSWORD,
};

const taskQueue = new Queue('sampletestqueue', {
  connection: redisConnection,
});

export default class TestQueueWorker {
  public async addBulkTasks({ request, response }) {
    const jobs = request.input('tasks');
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return response.status(400).json({
        error: 'Invalid tasks input. Provide an array of tasks.',
      });
    }
    try {
      await taskQueue.addBulk(
        jobs.map((task) => ({
          name: task.name,
          data: task.data,
          opts: {
            priority: task.opts?.priority ?? 0,
            tags: task.opts?.tags ?? [], 
          },
        }))
      );

      return response.status(200).json({
        message: `${jobs.length} tasks added to the queue successfully.`,
      });
    } catch (error) {
      console.error('Error adding tasks to queue:', error);
      return response.status(500).json({
        error: error.message,
      });
    }
  }

  public async startWorker(){
    const worker = new Worker(
      'sampletestqueue',
      async (job) => {
        console.log(`Received job: ${JSON.stringify(job)}`);
        const taskName = job.data?.data?.taskName;
        console.log(`Extracted taskName: ${taskName}`);
        if (taskName === 'Retries Exceeded') {
          throw new Error('Exceeded attempts');
        }
        console.log('Job completed successfully');
        return `Processed job ID: ${job.id}`;
      },
      {
        connection: redisConnection,
      }
    );
    worker.on('completed', (job) => {
      console.log(`Job completed: ${job.id}, Name: ${job.name}`);
    });
    
    worker.on('failed', (job, error) => {
      console.error(`Job ${job?.id || 'unknown'} failed: ${error.message}`);
    });
    
    worker.on('error', (err) => {
      console.error('Worker encountered an error:', err);
    });
  }



  // public async startWorker(response){
  //   try {
  //     const worker = new Worker(
  //       'sampletest',
  //       async (job) => {
  //         console.log(`Processing job ID: ${job.id}, Name: ${job.name}`);
  //         if (job.name === 'DATABASE') {
  //           throw new Error('Database error: Unable to connect');
  //         }
  //         if (job.name === 'timeoutJob') {
  //           throw new Error('Timeout error: Job processing took too long');
  //         }
  //         return `Processed job ID: ${job.id}`;
  //       },
  //       {
  //         connection: redisConnection,
  //         metrics: {
  //           maxDataPoints: MetricsTime.ONE_WEEK * 2,
  //         },
  //       }
  //     );
  
  //     worker.on('completed', (job) => {
  //       console.log(`Job completed: ${job.id}, Name: ${job.name}`);
  //     });
  
  //     worker.on('failed', (job, error) => {
  //       console.error(`Job ${job?.id || 'unknown'} failed: ${error.message}`);
  //     });
  
  //     console.log('Worker started and listening to the queue.');
  //     response.send({
  //       status: 'Worker started and processing jobs from taskQueue.',
  //     });
  //   } catch (error) {
  //     console.error('Error starting worker:', error);
  //     response.status(500).send({
  //       error: 'Failed to start worker',
  //       details: error.message,
  //     });
  //   }
  // }
  

//   public async startWorker({ response }) {
//     try {
//       const worker = new Worker(
//         'testq1',
//         async (job) => await this.metaBasedJobProcessor(job),
//         {
//           connection: redisConnection,
//           metrics: {
//             maxDataPoints: MetricsTime.ONE_WEEK * 2,
//           },
//           concurrency: 5, 
//         }
//       );

//       worker.on('completed', (job) => {
//         console.log(`Job completed: ${job.id}, Name: ${job.name}`);
//       });

//       worker.on('failed', (job, error) => {
//         console.error(`Job ${job.id} failed: ${error.message}`);
//       });

//       console.log('Worker started and listening to the queue.');
//       response.send({
//         status: `Worker started and processing jobs from taskQueue.`,
//       });
//     } catch (error) {
//       console.error('Error starting worker:', error);
//       response.status(500).send({
//         error: 'Failed to start worker',
//         details: error.message,
//       });
//     }
//   }

  public async metaBasedJobProcessor(job: Job) {
    try {
      console.log(`Processing job ${job.id} with priority ${job.opts.priority}:`, job.data);
      const meta = job.data;

      if (meta.description.includes('email')) {
        await this.processEmail(meta);
      } else if (meta.description.includes('folder')) {
        await this.processFolder(meta);
      } else if (meta.description.includes('SMS')) {
        await this.processSMS(meta);
      } else if (meta.description.includes('SMTP')) {
        await this.processSMTP(meta);
      } else if (meta.description.includes('Drive')) {
        await this.processDrive(meta);
      } else {
        console.warn(`No processing logic defined for job meta:`, meta);
      }
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      throw error;
    }
  }

  public async processEmail(meta) {
    console.log(`Executing Email Task: ${meta.description}`);
    await this.delayTask();
  }

  public async processFolder(meta) {
    console.log(`Executing Folder Task: ${meta.description}`);
    await this.delayTask();
  }

  public async processSMS(meta) {
    console.log(`Executing SMS Task: ${meta.description}`);
    await this.delayTask();
  }

  public async processSMTP(meta) {
    console.log(`Executing SMTP Task: ${meta.description}`);
    await this.delayTask();
  }

  public async processDrive(meta) {
    console.log(`Executing Drive Task: ${meta.description}`);
    await this.delayTask();
  }

  public async delayTask() {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  public async getQueueJobData({ request, response }) {
     const queueName = request.input('queueName');
     if (!queueName) {
       return response.status(400).json({ error: 'Queue name is required.' });
     }
   
     try {
       const queue = new Queue(queueName, { connection: redisConnection });
  
       type FormattedJob = {
         id: number;
         name: string;
         data: any;
         metadata: any;
         priority: number;
         state: string;
       };
   
       const formatJobs = async (jobs, state: string): Promise<FormattedJob[]> => {
         return Promise.all(
           jobs.map(async (job) => {
             const jobState = await job.getState();
             return {
               id: job.id,
               name: job.name,
               data: job.data,
               metadata: job.data.metadata || [],
               priority: job.opts.priority,
               state: jobState,
             };
           })
         );
       };
   
       const [waitingJobs, activeJobs, completedJobs, failedJobs, prioritizedJobs] = await Promise.all([
         queue.getWaiting(),
         queue.getActive(),
         queue.getCompleted(),
         queue.getFailed(),
         queue.getPrioritized(),
       ]);
  
       const [formattedWaitingJobs, formattedActiveJobs, formattedCompletedJobs, formattedFailedJobs, formattedPrioritizedJobs] = await Promise.all([
         formatJobs(waitingJobs, 'waiting'),
         formatJobs(activeJobs, 'active'),
         formatJobs(completedJobs, 'completed'),
         formatJobs(failedJobs, 'failed'),
         formatJobs(prioritizedJobs, 'prioritized'),
       ]);
   
       return response.status(200).json({
         queueName,
         waitingJobs: formattedWaitingJobs,
         activeJobs: formattedActiveJobs,
         completedJobs: formattedCompletedJobs,
         failedJobs: formattedFailedJobs,
         prioritizedJobs: formattedPrioritizedJobs,
       });
     } catch (error) {
       console.error('Error getting queue job data:', error);
       return response.status(500).json({ error: error.message });
     }
   }  


  public async emptyQueue({ request, response }) {
    const queueName = request.input('queueName');
    if (!queueName) {
      return response.status(400).json({
        error: 'Queue name is required.',
      });
    }
    try {
      const queue = new Queue(queueName, { connection: redisConnection });
      const queueResult = await queue.obliterate()
      console.log('---drained',queueResult);;
    } catch (error) {
      console.error('Error empty Queue queue job data:', error);
      return response.status(500).json({
        error: error.message,
      });
    }
  }

public async fetchTasksFromConductor({request}: HttpContextContract){
  const { workflowId } = request.qs();
  let workflowData = "";
  const conductor_url = 'http://cloud.aira.technology:8080/';
     await axios.get(`${conductor_url}api/workflow/${workflowId}?includeTasks=true`)
      .then(async (res) => {
        workflowData = res.data.tasks;
      })
      .catch((err) => {
        workflowData = err;
      });
      return workflowData;
    }
  }
