import { startRuntime } from '@/src/runtime';
import { stubBrain } from '@/src/runtime/stubBrain';
// import { brain } from '@/src/brain';

export default defineBackground(() => {
  startRuntime(stubBrain); // SWITCH: change to startRuntime(brain) (and uncomment the import) once A lands
});
