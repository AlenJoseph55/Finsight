#!/usr/bin/env python3
"""
FinSight — Export AWS SSM Parameter Store parameters to .env file
Fetches all parameters under a given prefix (e.g. /finsight/prod/)
and formats them into standard KEY=VALUE pairs.
"""

import json
import os
import subprocess
import sys


def fetch_parameters(path_prefix: str) -> dict[str, str]:
    if not path_prefix.endswith("/"):
        path_prefix += "/"

    # If AWS_DEFAULT_REGION is not set, try to detect it or fallback
    if "AWS_DEFAULT_REGION" not in os.environ and "AWS_REGION" not in os.environ:
        try:
            token_cmd = ["curl", "-s", "-X", "PUT", "http://169.254.169.254/latest/api/token", "-H", "X-aws-ec2-metadata-token-ttl-seconds: 60"]
            token = subprocess.check_output(token_cmd, timeout=2).decode().strip()
            region_cmd = ["curl", "-s", "-H", f"X-aws-ec2-metadata-token: {token}", "http://169.254.169.254/latest/meta-data/placement/region"]
            region = subprocess.check_output(region_cmd, timeout=2).decode().strip()
            if region:
                os.environ["AWS_DEFAULT_REGION"] = region
        except Exception:
            pass

    env_vars = {}
    next_token = None

    while True:
        cmd = [
            "aws",
            "ssm",
            "get-parameters-by-path",
            "--path",
            path_prefix,
            "--with-decryption",
            "--output",
            "json",
        ]
        if next_token:
            cmd.extend(["--next-token", next_token])

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"Error fetching parameters from SSM:\n{result.stderr}", file=sys.stderr)
            sys.exit(result.returncode)

        data = json.loads(result.stdout)
        for param in data.get("Parameters", []):
            full_name = param["Name"]
            key = full_name[len(path_prefix):]
            env_vars[key] = param["Value"]

        next_token = data.get("NextToken")
        if not next_token:
            break

    return env_vars


def main():
    path_prefix = os.getenv("SSM_PARAM_PATH", "/finsight/prod/")
    output_file = sys.argv[1] if len(sys.argv) > 1 else ".env"

    print(f"Fetching SSM parameters from prefix: {path_prefix}")
    params = fetch_parameters(path_prefix)

    if not params:
        print(f"Warning: No parameters found under prefix {path_prefix}", file=sys.stderr)
        return

    with open(output_file, "w") as f:
        f.write("# Auto-generated from AWS SSM Parameter Store\n")
        f.write(f"# Path: {path_prefix}\n\n")
        for key in sorted(params.keys()):
            f.write(f"{key}={params[key]}\n")

    # Set restricted permissions on the generated .env file (owner read/write only)
    os.chmod(output_file, 0o600)
    print(f"Successfully generated {output_file} with {len(params)} environment variables.")


if __name__ == "__main__":
    main()
