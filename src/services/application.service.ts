import { listApplications } from "./application/list";
import { createApplication } from "./application/create";
import { acceptApplication, rejectApplication } from "./application/action";

export class ApplicationService {
static readonly listApplications = listApplications;
static readonly createApplication = createApplication;
static readonly acceptApplication = acceptApplication;
static readonly rejectApplication = rejectApplication;
}
