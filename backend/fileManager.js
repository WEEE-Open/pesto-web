import fs from 'fs/promises';
import path from 'path';

class FileManager {
	constructor(root) {
		if (typeof root !== "string") {
			throw new Error("root file folder is not set!");
		}

		this.root = root || "";
		this.ready = false;

		(async () => {
			if (await this.existsFolder(this.root) === false) {
				await this.createFolder(this.root);
			}
			this.ready = true;
		})();
	}

	async getPathStats(path) {
		let stats = await fs.stat(path);
		let output = {
			size: stats.size,
			created: stats.birthtimeMs,
			modified: stats.mtimeMs,
			type: stats.isDirectory() ? 'folder' : 'file',
			//isSymbolicLink: stats.isSymbolicLink(),
			isReadonly: !(stats.mode & 128),
		};
		if (stats.isDirectory()) {
			await fs.readdir(path).then((files) => {
				output.files = files;
			});
		}
		return output;
	}

	async readFileAsString(file) {
		return fs.open(file, 'r').then(async (fd) => {
			return fd.readFile();
		});
	}

	async readFile(file) {
		return fs.open(file, 'r').then(async (fd) => {
			return fd.createReadStream();
		});
	}

	async listDir(folder) {
		return fs.readdir(folder);
	}

	/**
	 * @description Move or rename a file or folder
	 */
	async move(oldPath, newPath) {
		return fs.rename(oldPath, newPath);
	}

	async deleteFile(file) {
		if (await this.existsFile(file) === false) return;
		return fs.unlink(file);
	}

	async saveFile(file, data) {
		const stream = await this.createFile(file);
		stream.write(data);
		stream.end();
	}

	async createFileIfNotExists(file) {
		if (await this.exists(file)) return;
		await this.createEmptyFile(file);
	}

	async createEmptyFile(file) {
		let stream = await this.createFile(file);
		stream.end();
	}

	async createFile(file) {
		return fs.open(file, 'w').then(async (fd) => {
			return fd.createWriteStream();
		});
	}

	async createFolder(folder) {
		return fs.mkdir(folder, { recursive: true });
	}

	async exists(path) {
		return fs.access(path).then(() => true).catch(() => false);
	}

	async existsFolder(folder) {
		if (!(await this.exists(folder))) return false;
		const stat = await fs.stat(folder);
		return stat.isDirectory();
	}

	async existsFile(file) {
		if (!(await this.exists(file))) return false;
		const stat = await fs.stat(file);
		return stat.isFile();
	}

	safeJoin(...paths) {
		const joinedPath = path.join(...paths);
		if (this.isPathSafe(joinedPath)) {
			return joinedPath;
		} else {
			throw new Error('Invalid path');
		}
	}

	isPathSafe(normalizedPath) {
		// const normalizedPath = path.normalize(this.root + path.sep + path_);
		return normalizedPath.startsWith(path.normalize(this.root + path.sep));
	}
}

export default FileManager;