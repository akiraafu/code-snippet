//
// Expected request:
// PUT /uploads/:uploadId
//
// Headers:
//   Content-Type: application/octet-stream
//   x-file-sha256: we expect 64-character hexadecimal SHA-256 digest calculated by the local agent client
//
// Body:
//   Raw binary file data
//
app.put("/uploads/:uploadId", async (request, response, next) => {
  try {
    const { uploadId } = request.params;
    const expectedHash = request.header("x-file-sha256");

    if (!expectedHash) {
      return response.status(400).json({
        error: "x-file-sha256 is required.",
      });
    }

    const uploadDirectory = path.join("uploads", uploadId);
    const destination = path.join(uploadDirectory, "uploaded-file");

    await fs.promises.mkdir(uploadDirectory, { recursive: true });

    const hash = createHash("sha256");
    const output = createWriteStream(destination);

    // Hash the incoming file while streaming it to disk.
    request.on("data", (chunk: Buffer) => {
      hash.update(chunk);
    });

    request.pipe(output);

    await new Promise<void>((resolve, reject) => {
      output.once("finish", resolve);
      output.once("error", reject);
      request.once("error", reject);
    });

    // Calculate the SHA-256 hash of the complete received file.
    const actualHash = hash.digest("hex");

    // Verify that the received file matches the hash supplied by the client.
    if (actualHash !== expectedHash) {
      await fs.promises.unlink(destination);

      return response.status(422).json({
        error: "File checksum did not match.",
      });
    }

    return response.status(204).end();
  } catch (error) {
    next(error);
  }
});