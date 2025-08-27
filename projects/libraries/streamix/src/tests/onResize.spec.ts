import { onResize } from "@actioncrew/streamix";

xdescribe('Functional tests for fromResizeObserver', () => {
  it('should detect element resize changes', (done) => {
    const divToTest = document.createElement('div');
    divToTest.style.width = '100px';
    divToTest.style.height = '100px';
    document.body.appendChild(divToTest);

    const resizeStream = onResize(divToTest);

    const subscription = resizeStream.subscribe({
      next: (resizeData: any) => {
        try {
          expect(resizeData.width).toBe(200);
          expect(resizeData.height).toBe(200);
          subscription.unsubscribe();
          done();
        } catch (error: any) {
          done.fail(error);
        }
      },
      complete: () => {}
    });

    // Simulate resize by modifying the mocked ResizeObserver's contentRect
    setTimeout(() => {
      divToTest.style.width = '200px';
      divToTest.style.height = '200px';
    }, 100);
  });
});
