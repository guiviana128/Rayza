import {get,put} from '@vercel/blob';
import {createRepository} from './repository-core.js';
import {createBlobAdapter} from './blob-adapter.js';
export const repository=createRepository(createBlobAdapter({get,put}));
