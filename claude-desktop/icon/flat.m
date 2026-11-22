#import <AppKit/AppKit.h>
// Icono plano actual de Claude: destello naranja sobre crema, en rejilla de icono macOS.
static NSImage *tinted(NSImage *src, NSColor *c, NSSize s) {
  NSImage *img = [[NSImage alloc] initWithSize:s];
  [img lockFocus];
  [src drawInRect:NSMakeRect(0, 0, s.width, s.height) fromRect:NSZeroRect operation:NSCompositingOperationSourceOver fraction:1];
  [c set]; NSRectFillUsingOperation(NSMakeRect(0, 0, s.width, s.height), NSCompositingOperationSourceAtop);
  [img unlockFocus];
  return img;
}
int main(int argc, const char **argv) {
  @autoreleasepool {
    NSImage *spark = [[NSBundle bundleWithPath:@(argv[1])] imageForResource:@"ClaudeSpark"];
    if (!spark) { fprintf(stderr, "no ClaudeSpark\n"); return 1; }
    NSString *dir = @(argv[2]);
    [NSFileManager.defaultManager createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
    NSColor *bg = [NSColor colorWithSRGBRed:0xD9/255.0 green:0x77/255.0 blue:0x57/255.0 alpha:1];
    NSColor *fg = NSColor.whiteColor;
    int sizes[] = {16, 32, 128, 256, 512};
    for (int i = 0; i < 5; i++) for (int sc = 1; sc <= 2; sc++) {
      int px = sizes[i] * sc;
      NSBitmapImageRep *rep = [[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL pixelsWide:px pixelsHigh:px bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSCalibratedRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
      [NSGraphicsContext saveGraphicsState];
      NSGraphicsContext.currentContext = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
      NSGraphicsContext.currentContext.imageInterpolation = NSImageInterpolationHigh;
      CGFloat m = px * 100.0 / 1024, side = px - 2 * m;
      NSRect box = NSMakeRect(m, m + px * 0.008, side, side);
      NSBezierPath *sq = [NSBezierPath bezierPathWithRoundedRect:box xRadius:side * 0.225 yRadius:side * 0.225];
      NSShadow *sh = [NSShadow new]; sh.shadowColor = [NSColor colorWithWhite:0 alpha:0.28];
      sh.shadowBlurRadius = px * 0.012; sh.shadowOffset = NSMakeSize(0, -px * 0.008);
      [NSGraphicsContext saveGraphicsState]; [sh set]; [bg set]; [sq fill]; [NSGraphicsContext restoreGraphicsState];
      CGFloat ss = side * 0.62, aspect = spark.size.width / spark.size.height;
      NSSize sz = aspect >= 1 ? NSMakeSize(ss, ss / aspect) : NSMakeSize(ss * aspect, ss);
      NSImage *t = tinted(spark, fg, sz);
      [t drawInRect:NSMakeRect(NSMidX(box) - sz.width / 2, NSMidY(box) - sz.height / 2, sz.width, sz.height) fromRect:NSZeroRect operation:NSCompositingOperationSourceOver fraction:1];
      [NSGraphicsContext restoreGraphicsState];
      NSString *name = sc == 1 ? [NSString stringWithFormat:@"icon_%dx%d.png", sizes[i], sizes[i]] : [NSString stringWithFormat:@"icon_%dx%d@2x.png", sizes[i], sizes[i]];
      [[rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}] writeToFile:[dir stringByAppendingPathComponent:name] atomically:YES];
    }
  }
  return 0;
}
