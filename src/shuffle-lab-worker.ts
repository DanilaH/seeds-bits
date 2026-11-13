import {searchShuffle} from "./shuffle-lab";
self.onmessage=e=>self.postMessage(searchShuffle(e.data));
