import { HttpErrorResponse } from "@angular/common/http";
import { DebugElement, NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { ServerError } from "@batch-flask/core";
import { I18nTestingModule } from "@batch-flask/core/testing";
import { NotificationService } from "@batch-flask/ui/notifications";
import { SidebarRef } from "@batch-flask/ui/sidebar";
import { ApplicationCreateDialogComponent } from "app/components/application/action";
import { BatchApplicationPackage } from "app/models";
import { BatchApplicationPackageService, BatchApplicationService } from "app/services";
import { StorageBlobService } from "app/services/storage";
import { Subject, of, throwError } from "rxjs";
import * as Fixtures from "test/fixture";
import * as TestConstants from "test/test-constants";
import { validateControl } from "test/utils/helpers";
import { MockedFile } from "test/utils/mocks";
import { ServerErrorMockComponent, complexFormMockComponents } from "test/utils/mocks/components";
import { isNode } from '@azure/core-http';

describe("ApplicationCreateDialogComponent ", () => {
    let fixture: ComponentFixture<ApplicationCreateDialogComponent>;
    let component: ApplicationCreateDialogComponent;
    let de: DebugElement;
    let appServiceSpy: any;
    let appPackageServiceSpy: any;
    let storageBlobService: any;
    let notificationServiceSpy: any;

    const validators = TestConstants.validators;

    beforeEach(() => {
        appServiceSpy = {
            onApplicationAdded: new Subject(),
        };

        appPackageServiceSpy = {
            put: jasmine.createSpy("put").and.callFake((applicationId, version) => {
                if (applicationId === "throw-me") {

                    return throwError(ServerError.fromARM(new HttpErrorResponse({
                        status: 400,
                        error: { message: "blast, we failed" },
                        statusText: "Bad request",
                    })));
                }

                return of(new BatchApplicationPackage({
                    id: `${applicationId}/versions/${version}`,
                    name: version,
                    properties: { storageUrl: "https://some/url" } as any,
                }));
            }),

            activate: jasmine.createSpy("activate").and.callFake((packageId: string) => {
                if (packageId.startsWith("activate-fail")) {

                    return throwError(ServerError.fromARM(new HttpErrorResponse({
                        status: 400,
                        error: { message: "blast, we failed" },
                        statusText: "error, error, error",
                    })));
                }

                return of({});
            }),
            onPackageAdded: new Subject(),

        };

        storageBlobService = {
            uploadToSasUrl: jasmine.createSpy("uploadToSasUrl").and.returnValue(of({})),
        };

        notificationServiceSpy = {
            success: jasmine.createSpy("success"),

            error: jasmine.createSpy("error"),
        };

        TestBed.configureTestingModule({
            imports: [I18nTestingModule],
            declarations: [...complexFormMockComponents, ApplicationCreateDialogComponent, ServerErrorMockComponent],
            providers: [
                { provide: FormBuilder, useValue: new FormBuilder() },
                { provide: SidebarRef, useValue: null },
                { provide: BatchApplicationService, useValue: appServiceSpy },
                { provide: BatchApplicationPackageService, useValue: appPackageServiceSpy },
                { provide: StorageBlobService, useValue: storageBlobService },
                { provide: NotificationService, useValue: notificationServiceSpy },
            ],
            schemas: [NO_ERRORS_SCHEMA],
        });

        fixture = TestBed.createComponent(ApplicationCreateDialogComponent);
        component = fixture.componentInstance;
        de = fixture.debugElement;
        fixture.detectChanges();

        //  form = component. form;
    });

    it("Should show title and description", () => {
        expect(de.nativeElement.textContent).toContain("Create application package");
        expect(de.nativeElement.textContent).toContain("Upload an application package"
            + " and give it an identifier to create your application");
    });

    describe("Application name", () => {
        it("control is initialized", () => {
            const input = de.query(By.css("input[formControlName=name]")).nativeElement;
            expect(input).toBeDefined();
        });

        it("control has required validation", () => {
            validateControl(component.form, "name").fails(validators.required).with("");
            validateControl(component.form, "name").passes(validators.required).with("bob");
        });

        it("control has maxLength validation", () => {
            validateControl(component.form, "name").fails(validators.maxlength).with("a".repeat(65));
            validateControl(component.form, "name").passes(validators.maxlength).with("a".repeat(64));
        });

        it("control has pattern validation", () => {
            validateControl(component.form, "name").fails(validators.pattern).with("invalid app id");
            validateControl(component.form, "name").passes(validators.pattern).with("valid-id");
        });
    });

    describe("Package version", () => {
        it("control is initialized", () => {
            const input = de.query(By.css("input[formControlName=version]")).nativeElement;
            expect(input).toBeDefined();
        });

        it("control has required validation", () => {
            validateControl(component.form, "version").fails(validators.required).with("");
            validateControl(component.form, "version").passes(validators.required).with("1");
        });

        it("control has maxLength validation", () => {
            validateControl(component.form, "version").fails(validators.maxlength).with("a".repeat(65));
            validateControl(component.form, "version").passes(validators.maxlength).with("a".repeat(64));
        });

        it("control has pattern validation", () => {
            validateControl(component.form, "version").fails(validators.pattern).with("1 2 1");
            validateControl(component.form, "version").passes(validators.pattern).with("1.2.1");
        });
    });

    describe("Package File", () => {
        it("control is initialized", () => {
            const input = de.query(By.css("bl-directory-picker")).nativeElement;
            expect(input).toBeDefined();
        });

        it("control has required validation", () => {
            validateControl(component.form, "package").fails(validators.required).with("");
            validateControl(component.form, "package").passes(validators.required).with("bob.zip");
        });

        it("control has pattern validation", () => {
            validateControl(component.form, "package").fails(validators.pattern).with("file.text");
            validateControl(component.form, "package").passes(validators.pattern).with("file.zip");
        });
    });

    describe("Passing in application populates form", () => {
        beforeEach(() => {
            component.setValue(Fixtures.application.create({ name: "monkeys" }));
            fixture.detectChanges();
        });

        it("sets the application name", () => {
            expect(component.form.controls["name"].value).toBe("monkeys");
        });

        it("updates the description", () => {
            const description = "Upload a new package version for the selected application";
            expect(de.nativeElement.textContent).toContain(description);
        });
    });

    describe("Passing in application and version populates form", () => {
        beforeEach(() => {
            component.setValue(Fixtures.application.create({ name: "more-monkeys" }), "12.5");
            fixture.detectChanges();
        });

        it("sets the application id", () => {
            expect(component.form.controls["name"].value).toBe("more-monkeys");
        });

        it("sets the version", () => {
            expect(component.form.controls["version"].value).toBe("12.5");
        });

        it("updates the description", () => {
            const description = "Select a new package to overwrite the existing version";
            expect(de.nativeElement.textContent).toContain(description);
        });

        it("updates the title", () => {
            expect(de.nativeElement.textContent).toContain("Update selected package");
        });
    });

    describe("Submitting action form", () => {
        beforeEach(() => {
            component.form.controls["name"].setValue("app-5");
            component.form.controls["version"].setValue("1.0");
            component.form.controls["package"].setValue("bob.zip");
            component.file = new MockedFile({
                name: "GreenButtonIntegrationTest-1.0.zip",
                path: "C:\Users\ascobie\Desktop\App Images\GreenButtonIntegrationTest-1.0.zip",
                lastModifiedDate: new Date(),
                type: "application/x-zip-compressed",
                webkitRelativePath: "",
                size: 2876,
            });

            fixture.detectChanges();
        });

        it("Clicking add creates and doesn't close sidebar", (done) => {
            component.submit().subscribe(() => {
                expect(appPackageServiceSpy.put).toHaveBeenCalledTimes(1);
                expect(appPackageServiceSpy.put).toHaveBeenCalledWith("app-5", "1.0");

                expect(storageBlobService.uploadToSasUrl).toHaveBeenCalledOnce();

                expect(appPackageServiceSpy.activate).toHaveBeenCalledTimes(1);
                expect(appPackageServiceSpy.activate).toHaveBeenCalledWith("app-5/versions/1.0");

                expect(notificationServiceSpy.error).toHaveBeenCalledTimes(0);
                expect(notificationServiceSpy.success).toHaveBeenCalledTimes(1);
                expect(notificationServiceSpy.success).toHaveBeenCalledWith(
                    "Application added!",
                    "Version 1.0 for application 'app-5' was successfully created!",
                );

                done();
            });

            appServiceSpy.onApplicationAdded.subscribe({
                next: (appId) => {
                    expect(appId).toEqual("app-5");
                },
            });
        });

        it("If create application throws we handle the error", (done) => {
            component.form.controls["name"].setValue("throw-me");
            fixture.detectChanges();

            component.submit().subscribe({
                next: () => {
                    fail("call should have failed");
                    done();
                },
                error: (error: ServerError) => {
                    expect(error.statusText).toBe("Bad request");
                    expect(error.toString()).toBe("400 - Bad request - blast, we failed");

                    expect(appPackageServiceSpy.put).toHaveBeenCalledTimes(1);
                    expect(appPackageServiceSpy.put).toHaveBeenCalledWith("throw-me", "1.0");

                    expect(storageBlobService.uploadToSasUrl).not.toHaveBeenCalled();
                    expect(appPackageServiceSpy.activate).toHaveBeenCalledTimes(0);
                    expect(notificationServiceSpy.success).toHaveBeenCalledTimes(0);

                    done();
                },
            });

            appServiceSpy.onApplicationAdded.subscribe({
                next: (appId) => {
                    fail("onApplicationAdded should not have been called");
                },
            });
        });

        it("If activate package throws we carry on and notify the user", async () => {
            component.form.controls["name"].setValue("activate-fail");
            fixture.detectChanges();

            const appAddedSpy  = jasmine.createSpy("appAdded");
            appServiceSpy.onApplicationAdded.subscribe(appAddedSpy);
            await component.submit().toPromise();
            expect(appPackageServiceSpy.put).toHaveBeenCalledTimes(1);
            expect(appPackageServiceSpy.put).toHaveBeenCalledWith("activate-fail", "1.0");
            expect(storageBlobService.uploadToSasUrl).toHaveBeenCalledOnce();
            expect(appPackageServiceSpy.activate).toHaveBeenCalledTimes(1);
            expect(notificationServiceSpy.success).toHaveBeenCalledTimes(0);
            expect(notificationServiceSpy.error).toHaveBeenCalledTimes(1);
            expect(notificationServiceSpy.error).toHaveBeenCalledWith(
                "Activation failed",
                "The application package was uploaded into storage successfully, "
                + "but the activation process failed.",
            );

            expect(appAddedSpy).toHaveBeenCalledTimes(1);
            expect(appAddedSpy).toHaveBeenCalledWith("activate-fail");
        });

        it ("isNode from @azure/core-http should be false in the renderer process", async () => {
            // see patches/@azure+core-http+2.2.7.patch
            expect(isNode).toBe(false);
        });

    });
});
