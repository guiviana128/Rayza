export async function deleteMemorySafely(removeRow,removePhoto) {
  // Se a linha não foi excluída, o arquivo permanece intacto.
  await removeRow();
  try {await removePhoto();return {cleanupFailed:false};}
  catch {return {cleanupFailed:true};}
}
