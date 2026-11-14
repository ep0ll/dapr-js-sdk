/*
Copyright 2026 The Dapr Authors
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import HTTPServer from "./HTTPServer";
import IServerJobs from "../../../interfaces/Server/IServerJobs";
import { validateJobRoutePath } from "../../../jobs/Jobs.util";
import { Logger } from "../../../logger/Logger";

export default class HTTPServerJobs implements IServerJobs {
  private readonly handlers = new Map<string, Parameters<IServerJobs["listen"]>[1]>();

  constructor(private readonly server: HTTPServer) {}

  private registerRoute(): void {
    const logger = new Logger("HTTPServer", "Jobs", this.server.client.options.logger);
    this.server.getServer().post("/job/*", async (req, res) => {
      const routePath = req.params[0];
      const callback = this.handlers.get(routePath);
      if (!callback) {
        logger.warn(`Job route '${routePath}' was not handled`);
        res.sendStatus(404);
        return;
      }
      try {
        await callback(req.headers["content-length"] === "0" ? undefined : req.body);
        res.sendStatus(200);
      } catch (error) {
        logger.error(`Job route '${routePath}' callback failed: ${error}`);
        res.status(500).json({ error: "COULD_NOT_PROCESS_CALLBACK" });
      }
    });
  }

  async listen(name: string, callback: Parameters<IServerJobs["listen"]>[1]): Promise<void> {
    validateJobRoutePath(name);
    if (typeof callback !== "function") {
      throw new TypeError("A job callback is required");
    }
    if (this.handlers.has(name)) {
      throw new Error(`A handler for job route '${name}' is already registered`);
    }
    if (this.handlers.size === 0) {
      this.registerRoute();
    }
    this.handlers.set(name, callback);
  }
}
