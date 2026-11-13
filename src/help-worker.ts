import {searchHelp} from "./help-search";
self.onmessage = e => self.postMessage(searchHelp(e.data.board,e.data.kind));
