import { BrowserWindow, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import rimraf from 'rimraf'

export default class LocalFileSystem {
  constructor(private browserWindow: BrowserWindow) {}

  public async selectContainer(): Promise<string> {
    const { canceled, filePaths } = await dialog.showOpenDialog(this.browserWindow, {
      title: 'Select Folder',
      buttonLabel: 'Choose Folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (canceled) {
      return ''
    } else {
      return filePaths[0]
    }
  }

  public readText(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fs.readFile(path.normalize(filePath), (err, data) => {
        if (err) {
          return reject(err)
        }

        resolve(data.toString())
      })
    })
  }

  public readBinary(filePath: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      fs.readFile(path.normalize(filePath), (err, data) => {
        if (err) {
          return reject(err)
        }

        resolve(data)
      })
    })
  }

  public writeBinary(filePath: string, contents: Buffer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const containerName: fs.PathLike = path.normalize(path.dirname(filePath))
      const exists = fs.existsSync(containerName)
      if (!exists) {
        fs.mkdirSync(containerName)
      }

      fs.writeFile(path.normalize(filePath), contents, (err) => {
        if (err) {
          return reject(err)
        }

        resolve()
      })
    })
  }

  public writeText(filePath: string, contents: string): Promise<void> {
    const buffer = Buffer.from(contents)
    return this.writeBinary(filePath, buffer)
  }

  public deleteFile(filePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const exists = fs.existsSync(path.normalize(filePath))
      if (!exists) {
        resolve()
      }

      fs.unlink(filePath, (err) => {
        if (err) {
          return reject(err)
        }

        resolve()
      })
    })
  }

  public async listFiles(folderPath: string): Promise<string[]> {
    const normalizedPath = path.normalize(folderPath)
    const files = await this.listItems(normalizedPath, (stats) => !stats.isDirectory())
    const directories = await this.listItems(normalizedPath, (stats) => stats.isDirectory())
    directories.forEach(async (directory) => {
      const directoryFiles = await this.listFiles(directory)
      directoryFiles.forEach((file) => files.push(file))
    })
    return files
  }

  public listContainers(folderPath: string): Promise<string[]> {
    return this.listItems(path.normalize(folderPath), (stats) => stats.isDirectory())
  }

  public createContainer(folderPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.exists(path.normalize(folderPath), (exists) => {
        if (exists) {
          resolve()
        } else {
          fs.mkdir(path.normalize(folderPath), (err) => {
            if (err) {
              return reject(err)
            }

            resolve()
          })
        }
      })
    })
  }

  public async deleteContainer(folderPath: string): Promise<void> {
    if (fs.existsSync(path.normalize(folderPath))) {
      rimraf(path.normalize(folderPath))
    }
  }

  //   public async getAssets(
  //     sourceConnectionFolderPath?: string,
  //     relativePath: boolean = false
  //   ): Promise<IAsset[]> {
  //     const files = await this.listFiles(
  //       path.normalize(sourceConnectionFolderPath)
  //     );
  //     return files
  //       .map((filePath) =>
  //         AssetService.createAssetFromFilePath(
  //           filePath,
  //           undefined,
  //           relativePath
  //             ? path.relative(sourceConnectionFolderPath, filePath)
  //             : filePath
  //         )
  //       )
  //       .filter((asset) => asset.type !== AssetType.Unknown);
  //   }

  /**
   * Gets a list of file system items matching the specified predicate within the folderPath
   * @param  {string} folderPath
   * @param  {(stats:fs.Stats)=>boolean} predicate
   * @returns {Promise} Resolved list of matching file system items
   */
  private listItems(folderPath: string, predicate: (stats: fs.Stats) => boolean) {
    return new Promise<string[]>((resolve, reject) => {
      fs.readdir(path.normalize(folderPath), async (err, fileSystemItems: string[]) => {
        if (err) {
          return reject(err)
        }

        const getStatsTasks = fileSystemItems.map((name) => {
          const filePath = path.join(folderPath, name)
          return this.getStats(filePath)
        })

        try {
          const statsResults = await Promise.all(getStatsTasks)
          const filteredItems = statsResults
            .filter((result) => predicate(result.stats))
            .map((result) => result.path)

          resolve(filteredItems)
        } catch (err) {
          reject(err)
        }
      })
    })
  }

  /**
   * Gets the node file system stats for the specified path
   * @param  {string} path
   * @returns {Promise} Resolved path and stats
   */
  private getStats(path: string): Promise<{ path: string; stats: fs.Stats }> {
    return new Promise((resolve, reject) => {
      fs.stat(path, (err, stats: fs.Stats) => {
        if (err) {
          reject(err)
        }

        resolve({
          path,
          stats,
        })
      })
    })
  }
}
