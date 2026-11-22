#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>

static void out(id obj) {
  NSData *d = [NSJSONSerialization dataWithJSONObject:obj options:NSJSONWritingFragmentsAllowed error:nil];
  fwrite(d.bytes, 1, d.length, stdout);
  fputc('\n', stdout);
}

static NSArray *layer0Windows(void) {
  NSArray *list = CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID));
  NSMutableArray *r = [NSMutableArray array];
  for (NSDictionary *w in list) if ([w[(id)kCGWindowLayer] intValue] == 0) [r addObject:w];
  return r;
}

static NSDictionary *appInfo(pid_t pid) {
  NSRunningApplication *a = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
  return @{@"bundleId": a.bundleIdentifier ?: @"", @"displayName": a.localizedName ?: @"", @"pid": @(pid)};
}

int main(int argc, const char **argv) {
  @autoreleasepool {
    if (argc < 2) return 2;
    NSString *cmd = @(argv[1]);
    if ([cmd isEqual:@"running"]) {
      NSMutableArray *r = [NSMutableArray array];
      for (NSRunningApplication *a in NSWorkspace.sharedWorkspace.runningApplications)
        if (a.activationPolicy == NSApplicationActivationPolicyRegular && a.bundleIdentifier)
          [r addObject:@{@"bundleId": a.bundleIdentifier, @"displayName": a.localizedName ?: a.bundleIdentifier, @"pid": @(a.processIdentifier)}];
      out(r);
    } else if ([cmd isEqual:@"at"] && argc >= 4) {
      CGPoint p = CGPointMake(atof(argv[2]), atof(argv[3]));
      for (NSDictionary *w in layer0Windows()) {
        CGRect b; CGRectMakeWithDictionaryRepresentation((CFDictionaryRef)w[(id)kCGWindowBounds], &b);
        if (CGRectContainsPoint(b, p)) {
          NSMutableDictionary *d = [appInfo([w[(id)kCGWindowOwnerPID] intValue]) mutableCopy];
          d[@"windowNumber"] = w[(id)kCGWindowNumber];
          out(d); return 0;
        }
      }
      out([NSNull null]);
    } else if ([cmd isEqual:@"displays"]) {
      NSMutableDictionary *m = [NSMutableDictionary dictionary];
      for (int i = 2; i < argc; i++) m[@(argv[i])] = [NSMutableSet set];
      for (NSDictionary *w in layer0Windows()) {
        NSString *bid = [NSRunningApplication runningApplicationWithProcessIdentifier:[w[(id)kCGWindowOwnerPID] intValue]].bundleIdentifier;
        if (!bid || !m[bid]) continue;
        CGRect b; CGRectMakeWithDictionaryRepresentation((CFDictionaryRef)w[(id)kCGWindowBounds], &b);
        CGDirectDisplayID ids[16]; uint32_t n = 0;
        CGGetDisplaysWithRect(b, 16, ids, &n);
        for (uint32_t k = 0; k < n; k++) [m[bid] addObject:@(ids[k])];
      }
      NSMutableArray *r = [NSMutableArray array];
      for (NSString *bid in m) [r addObject:@{@"bundleId": bid, @"displayIds": [m[bid] allObjects]}];
      out(r);
    } else if ([cmd isEqual:@"hide"] || [cmd isEqual:@"unhide"]) {
      BOOL hide = [cmd isEqual:@"hide"];
      NSMutableArray *done = [NSMutableArray array];
      for (int i = 2; i < argc; i++)
        for (NSRunningApplication *a in [NSRunningApplication runningApplicationsWithBundleIdentifier:@(argv[i])])
          if (hide ? [a hide] : [a unhide]) [done addObject:@(argv[i])];
      out(done);
    } else if ([cmd isEqual:@"icon"] && argc >= 3) {
      NSString *path = [NSWorkspace.sharedWorkspace absolutePathForAppBundleWithIdentifier:@(argv[2])];
      if (!path) { out([NSNull null]); return 0; }
      NSImage *img = [NSWorkspace.sharedWorkspace iconForFile:path];
      NSBitmapImageRep *rep = [[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL pixelsWide:64 pixelsHigh:64 bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSCalibratedRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
      [NSGraphicsContext saveGraphicsState];
      NSGraphicsContext.currentContext = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
      [img drawInRect:NSMakeRect(0, 0, 64, 64)];
      [NSGraphicsContext restoreGraphicsState];
      NSData *png = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
      out([@"data:image/png;base64," stringByAppendingString:[png base64EncodedStringWithOptions:0]]);
    } else if ([cmd isEqual:@"shot"] && argc >= 7) {
      CGDirectDisplayID did = (CGDirectDisplayID)strtoul(argv[2], NULL, 10);
      if (did == 0) did = CGMainDisplayID();
      int outW = atoi(argv[3]), outH = atoi(argv[4]);
      double q = atof(argv[5]);
      pid_t ex = atoi(argv[6]);
      NSString *allowCSV = argc >= 8 ? @(argv[7]) : @"*";
      NSSet *allow = [allowCSV isEqual:@"*"] ? nil : [NSSet setWithArray:[allowCSV componentsSeparatedByString:@","]];
      CGRect rect = CGDisplayBounds(did);
      if (argc >= 12) rect = CGRectMake(atof(argv[8]), atof(argv[9]), atof(argv[10]), atof(argv[11]));
      NSArray *all = CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID));
      CFMutableArrayRef ids = CFArrayCreateMutable(NULL, 0, NULL);
      NSMutableDictionary *cache = [NSMutableDictionary dictionary];
      for (NSDictionary *w in all) {
        pid_t op = [w[(id)kCGWindowOwnerPID] intValue];
        if (ex > 0 && op == ex) continue;
        if (allow) {
          NSRunningApplication *a = cache[@(op)];
          if (!a) { a = [NSRunningApplication runningApplicationWithProcessIdentifier:op]; if (a) cache[@(op)] = a; }
          if (a && a.activationPolicy == NSApplicationActivationPolicyRegular && ![allow containsObject:a.bundleIdentifier ?: @""]) continue;
        }
        CFArrayAppendValue(ids, (const void *)(uintptr_t)[w[(id)kCGWindowNumber] unsignedIntValue]);
      }
      CGImageRef img = CGWindowListCreateImageFromArray(rect, ids, kCGWindowImageDefault);
      CFRelease(ids);
      if (!img) { fprintf(stderr, "capture failed\n"); return 1; }
      if (outW <= 0 || outH <= 0) { outW = (int)CGImageGetWidth(img); outH = (int)CGImageGetHeight(img); }
      NSBitmapImageRep *rep = [[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL pixelsWide:outW pixelsHigh:outH bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSCalibratedRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
      [NSGraphicsContext saveGraphicsState];
      NSGraphicsContext *ctx = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
      ctx.imageInterpolation = NSImageInterpolationHigh;
      NSGraphicsContext.currentContext = ctx;
      CGContextDrawImage(ctx.CGContext, CGRectMake(0, 0, outW, outH), img);
      [NSGraphicsContext restoreGraphicsState];
      CGImageRelease(img);
      NSData *jpg = [rep representationUsingType:NSBitmapImageFileTypeJPEG properties:@{NSImageCompressionFactor: @(q)}];
      out(@{@"base64": [jpg base64EncodedStringWithOptions:0], @"width": @(outW), @"height": @(outH)});
    } else if ([cmd isEqual:@"tcc-screen"]) {
      BOOL ok = NO;
      NSArray *all = CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly, kCGNullWindowID));
      pid_t me = getpid();
      for (NSDictionary *w in all) {
        if ([w[(id)kCGWindowOwnerPID] intValue] == me || [w[(id)kCGWindowOwnerName] isEqual:@"Dock"]) continue;
        if (w[(id)kCGWindowName]) { ok = YES; break; }
      }
      out(@(ok));
    } else return 2;
  }
  return 0;
}
