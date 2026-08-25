import {dailyPuzzleSeed} from '../daily.js';
import {puzzleIdFor} from '../domain/completion.js';
import {generateBloki} from './generator.js';
export async function loadBlokiDaily(dateKey){const version=1;const puzzle=generateBloki({seed:dailyPuzzleSeed('bloki',dateKey),difficulty:'medium'});return{game:'bloki',date:dateKey,version,puzzleId:puzzleIdFor('bloki',dateKey,version),puzzle};}
