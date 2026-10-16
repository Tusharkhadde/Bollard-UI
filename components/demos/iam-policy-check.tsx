"use client"

import { IamPolicyCheck } from "@/registry/default/iam-policy-check/iam-policy-check"

const POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Uploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::acme-uploads/*",
      "Condition": { "Bool": { "aws:SecureTransport": "true" } }
    },
    {
      "Sid": "KeepBucket",
      "Effect": "Deny",
      "NotPrincipal": { "AWS": "arn:aws:iam::111122223333:role/Admin" },
      "Action": "s3:DeleteBucket",
      "Resource": "arn:aws:s3:::acme-uploads"
    }
  ]
}`

export function Demo() {
  return <IamPolicyCheck label="acme-uploads bucket policy" defaultValue={POLICY} accountId="111122223333" />
}
