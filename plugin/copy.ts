import * as fs from "fs";
import path from "path";

function copyFolder(src:string,dst:string) {
	fs.mkdirSync(dst)
	let files = fs.readdirSync(src, { withFileTypes: true })
	
	for (let file of files) {
		let srcPath = path.join(src, file.name);
		let destPath = path.join(dst, file.name);
		
		file.isDirectory() ? copyFolder(srcPath,destPath) : fs.copyFileSync(srcPath,destPath)
	}
}

console.log("copying assets folder")

const srcPath = path.join(__dirname, "..", "src","assets")
const dstPath = path.join(__dirname, "..", "dist", "assets")
const pdxinfoPath = path.join(__dirname, "..", "src", "pdxinfo")

copyFolder(srcPath, dstPath)
fs.copyFileSync(
	pdxinfoPath,
	path.join(
		path.join(__dirname, "..", "dist"), "pdxinfo")
)