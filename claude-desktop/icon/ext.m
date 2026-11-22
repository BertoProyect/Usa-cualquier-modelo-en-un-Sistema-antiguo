#import <AppKit/AppKit.h>
int main(int c, char**v){@autoreleasepool{
 NSBundle*b=[NSBundle bundleWithPath:[NSString stringWithUTF8String:v[1]]];
 NSImage*img=[b imageForResource:@"Claude"]; if(!img){fprintf(stderr,"no image\n");return 1;}
 NSString*out=[NSString stringWithUTF8String:v[2]];
 [[NSFileManager defaultManager] createDirectoryAtPath:out withIntermediateDirectories:YES attributes:nil error:nil];
 int sz[]={16,32,128,256,512};
 for(int i=0;i<5;i++)for(int s=1;s<=2;s++){int px=sz[i]*s;
  NSBitmapImageRep*r=[[NSBitmapImageRep alloc]initWithBitmapDataPlanes:NULL pixelsWide:px pixelsHigh:px bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSDeviceRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
  [NSGraphicsContext saveGraphicsState];[NSGraphicsContext setCurrentContext:[NSGraphicsContext graphicsContextWithBitmapImageRep:r]];
  [[NSGraphicsContext currentContext] setImageInterpolation:NSImageInterpolationHigh];
  [img drawInRect:NSMakeRect(0,0,px,px) fromRect:NSZeroRect operation:NSCompositingOperationCopy fraction:1];
  [NSGraphicsContext restoreGraphicsState];
  NSString*n=s==1?[NSString stringWithFormat:@"icon_%dx%d.png",sz[i],sz[i]]:[NSString stringWithFormat:@"icon_%dx%d@2x.png",sz[i],sz[i]];
  [[r representationUsingType:NSBitmapImageFileTypePNG properties:@{}] writeToFile:[out stringByAppendingPathComponent:n] atomically:YES];}
 printf("reps: %lu\n",(unsigned long)img.representations.count);}return 0;}
