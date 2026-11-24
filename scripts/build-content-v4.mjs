// Run from repo root with Node 24+; intentionally no write mode.
import fs from "node:fs";
import assert from "node:assert/strict";
import * as core from "../src/core.ts";
import {createAuthor} from "./author-content-v4.mjs";
const root="docs/research/daily-notebook-design-2026-11-24/catalogue-v4/";
const get=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const author=createAuthor(core),ex=get(root+"exclusions.json");
const forbidden=new Set(ex.canonical),masks=new Set(ex.masks);
const counters={};let offset=0;
for(const [name,count,mode,asset] of [
 ["books-1",600,"book","content-v4-books-1"],["books-2",600,"book","content-v4-books-2"],
 ["books-3",600,"book","content-v4-books-3"],["books-4",600,"book","content-v4-books-4"],
 ["daily-365",365,"daily","content-v4-daily"]]){
 if(mode==="daily")offset=0;
 const raw=get(root+name+".json"),compact=get("src/"+asset+".json");
 for(let i=0;i<count;i++){
  const row=author.author(author.slot(offset+i,mode),forbidden,masks,counters);
  assert.deepEqual(row,raw[i],name+" "+i);
  assert.deepEqual(row.slice(0,2),compact[i],asset+" "+i);
 }
 offset+=count;console.log(name+" reproduced",count);
}
console.log(counters);
