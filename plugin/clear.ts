import { existsSync, rmSync } from "fs";
import path from "path";

const distPath = path.join(__dirname,"..","dist")
const gamePath = path.join(__dirname,"..","dist.pdx")

if (existsSync(distPath)) {
	console.log("deleting dist folder")
	rmSync(distPath,{recursive:true})
}

if (existsSync(gamePath)) {
	console.log("deleting dist.pdx")
	rmSync(gamePath,{recursive:true})
}
