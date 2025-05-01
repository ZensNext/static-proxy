import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { s3Client } from "./s3";
import { env } from "../env";

export function getErrorMessage(err: unknown) {
  const unknownError = "Something went wrong, please try again later.";

  if (err instanceof z.ZodError) {
    const errors = err.issues.map((issue) => {
      return issue.message;
    });

    return errors.join("\n");
  }
  if (err instanceof Error) {
    return err.message;
  }
  return unknownError;
}

export function getUrl(filename: string, expires = 3600) {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: filename,
    }),
    {
      expiresIn: expires,
    }
  );
}
