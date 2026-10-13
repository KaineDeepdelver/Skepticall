// Browser helpers to save / load the .dat file. (In React Native, write the bytes with
// your file-system library and hand them to the OS share sheet instead.)

export function backupFileName(date = new Date()) {
  return `skepticall-backup-${date.toISOString().slice(0, 10)}.dat`;
}

/** Offers the bytes as a download named `fileName`. */
export function downloadBackup(bytes, fileName = backupFileName()) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a File picked with <input type="file"> into bytes for restoreBackup(). */
export async function readBackupFile(file) {
  return new Uint8Array(await file.arrayBuffer());
}
