import { onResize } from "@actioncrew/streamix";
import { idescribe } from "./env.spec";

idescribe('onResize', () => {
  it('should detect element resize changes', (done) => {
    const divToTest = document.createElement('div');
    divToTest.style.width = '100px';
    divToTest.style.height = '100px';
    document.body.appendChild(divToTest);

    const resizeStream = onResize(divToTest);

    let firstEmission = true;

    const subscription = resizeStream.subscribe({
      next: (resizeData: any) => {
        try {
          if (firstEmission) {
            expect(resizeData.width).toBe(100);
            expect(resizeData.height).toBe(100);
            firstEmission = false;
            return;
          }

          // Assert the new size after resize
          expect(resizeData.width).toBe(200);
          expect(resizeData.height).toBe(200);

          subscription.unsubscribe();
          done();
        } catch (error: any) {
          done.fail(error);
        }
      },
      complete: () => { }
    });

    // Simulate resize
    setTimeout(() => {
      divToTest.style.width = '200px';
      divToTest.style.height = '200px';
    }, 100);
  });

  it('should clean up ResizeObserver when element is removed', (done) => {
    const divToTest = document.createElement('div');
    divToTest.style.width = '100px';
    divToTest.style.height = '100px';
    document.body.appendChild(divToTest);

    const resizeStream = onResize(divToTest);

    // Subscribe to the stream
    const subscription = resizeStream.subscribe({
      next: () => {},
      complete: () => { subscription.unsubscribe(); done(); } 
    });

    // Remove the element after a short delay
    setTimeout(() => {
      document.body.removeChild(divToTest);
    }, 50);
  });
});
