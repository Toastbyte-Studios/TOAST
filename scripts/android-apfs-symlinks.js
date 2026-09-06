#!/usr/bin/env node
/**
 * On macOS, ExFAT volumes can't store extended attributes inline, so macOS
 * creates ._<name> companion files for every directory Gradle touches during
 * an Android build. These files then break ParseLibraryResourcesTask and
 * CMake's add_subdirectory() calls mid-build.
 *
 * This script creates symlinks:
 *   node_modules/<pkg>/android/build  →  ~/Library/Caches/TOAST/android-build/libs/<pkg>
 *
 * All Gradle writes go through the symlink to the APFS target, so no ._* files
 * are created. CMake paths still resolve because the ExFAT symlink path exists.
 *
 * Run automatically via the "preandroid" npm script before every Android build.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

if (process.platform !== 'darwin') process.exit(0);

const root = path.resolve(__dirname, '..');
const nodeModules = path.join(root, 'node_modules');
const apfsBase = path.join(
  os.homedir(),
  'Library',
  'Caches',
  'TOAST',
  'android-build',
  'libs',
);

function findAndroidPackages(dir, scopePrefix) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const fullPath = path.join(dir, entry);
    if (scopePrefix === undefined && entry.startsWith('@')) {
      results.push(...findAndroidPackages(fullPath, entry));
      continue;
    }
    const pkgName = scopePrefix ? `${scopePrefix}/${entry}` : entry;
    // Some packages (e.g. react-native-sqlite-storage) use platforms/android/ instead of android/
    for (const candidate of ['android', 'platforms/android']) {
      const androidDir = path.join(fullPath, candidate);
      if (fs.existsSync(path.join(androidDir, 'build.gradle'))) {
        results.push({ pkgName, androidDir });
        break;
      }
    }
  }
  return results;
}

const packages = findAndroidPackages(nodeModules);
let created = 0;

for (const { pkgName, androidDir } of packages) {
  const buildLink = path.join(androidDir, 'build');
  const apfsTarget = path.join(apfsBase, pkgName);

  // If it's already a correct symlink, make sure its target still exists
  // (~/Library/Caches can be purged by macOS, leaving a dangling link) and skip.
  try {
    if (
      fs.lstatSync(buildLink).isSymbolicLink() &&
      fs.readlinkSync(buildLink) === apfsTarget
    ) {
      fs.mkdirSync(apfsTarget, { recursive: true });
      continue;
    }
  } catch {
    // doesn't exist yet
  }

  // Remove stale symlink or old real build dir.
  try {
    const stat = fs.lstatSync(buildLink);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(buildLink, { recursive: true, force: true });
    }
  } catch {
    // nothing to remove
  }

  fs.mkdirSync(apfsTarget, { recursive: true });
  fs.symlinkSync(apfsTarget, buildLink);
  created++;
}

if (created > 0)
  console.log(
    `[android-apfs-symlinks] Created ${created} symlink(s) → ~/Library/Caches/TOAST/android-build/libs/`,
  );
