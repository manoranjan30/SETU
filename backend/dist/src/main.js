"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpaFallbackFilter = void 0;
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const path_1 = require("path");
let SpaFallbackFilter = class SpaFallbackFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        if (request.url.startsWith('/api')) {
            response.status(404).json({
                statusCode: 404,
                message: `API Endpoint not found: ${request.url}`,
            });
        }
        else {
            response.sendFile((0, path_1.join)(__dirname, '..', 'client', 'index.html'));
        }
    }
};
exports.SpaFallbackFilter = SpaFallbackFilter;
exports.SpaFallbackFilter = SpaFallbackFilter = __decorate([
    (0, common_1.Catch)(common_1.NotFoundException)
], SpaFallbackFilter);
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors();
    app.useGlobalFilters(new SpaFallbackFilter());
    await app.listen(3000);
}
bootstrap();
//# sourceMappingURL=main.js.map