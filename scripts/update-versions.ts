import path from "path";
import fs from "fs-extra";

async function writeVersionToPackageJson({
  filePath,
  version,
}: {
  filePath: string;
  version: string;
}) {
  const packageJson = await fs.readJSON(filePath);

  packageJson.version = version;

  await fs.writeJSON(filePath, packageJson, { spaces: 2 });
}

async function writeVersionToModulesInFolder(
  inputFolder: string,
  version: string
) {
  const sourceFolder = path.join(__dirname, `../${inputFolder}`);

  const targetFolders = (await fs.readdir(sourceFolder)).filter((folder) => {
    return fs.pathExistsSync(path.join(sourceFolder, folder, "/package.json"));
  });

  await Promise.all(
    targetFolders.map((folder) =>
      writeVersionToPackageJson({
        filePath: path.join(sourceFolder, folder, "/package.json"),
        version,
      })
    )
  );
}

export async function updatePackageVersionsInRepository({
  version,
}: {
  version: string;
}) {
  /**
   * Update package versions
   */
  await writeVersionToModulesInFolder("packages", version);

  /**
   * Update app versions
   */
  await writeVersionToModulesInFolder("apps", version);

  /**
   * Update root package version
   */
  await writeVersionToPackageJson({
    filePath: path.join(__dirname, "../package.json"),
    version,
  });
}
