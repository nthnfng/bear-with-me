import { brain } from '@/src/brain';
import { startRuntime } from '@/src/runtime';

export default defineBackground(() => {
  startRuntime(brain);
});
