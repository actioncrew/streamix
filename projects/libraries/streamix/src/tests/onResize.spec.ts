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

  it('should clean up ResizeObserver when element is removed', () => {
    const divToTest = document.createElement('div');
    divToTest.style.width = '100px';
    divToTest.style.height = '100px';
    document.body.appendChild(divToTest);

    const resizeStream = onResize(divToTest);

    // Spy on the cleanup mechanism
    const disconnectSpy = spyOn(ResizeObserver.prototype, 'disconnect');

    const subscription = resizeStream.subscribe({
      next: () => { }
    });

    // Remove element and verify cleanup
    document.body.removeChild(divToTest);
    subscription.unsubscribe();

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('should clean up when unsubscribed', () => {
    const divToTest = document.createElement('div');
    document.body.appendChild(divToTest);

    const resizeStream = onResize(divToTest);
    const disconnectSpy = spyOn(ResizeObserver.prototype, 'disconnect');

    const subscription = resizeStream.subscribe({
      next: () => { }
    });

    subscription.unsubscribe();

    expect(disconnectSpy).toHaveBeenCalled();
    document.body.removeChild(divToTest);
  });

  it('should handle element removal without errors', (done) => {
    const divToTest = document.createElement('div');
    document.body.appendChild(divToTest);

    const resizeStream = onResize(divToTest);
    let errorOccurred = false;

    const subscription = resizeStream.subscribe({
      next: () => { },
      error: () => {
        errorOccurred = true;
      }
    });

    setTimeout(() => {
      document.body.removeChild(divToTest);
      subscription.unsubscribe();
      expect(errorOccurred).toBe(false);
      done();
    }, 50);
  });

  it('should emit dimensions when element is resized', (done) => {
    const div = document.createElement('div');
    div.style.width = '100px';
    div.style.height = '50px';
    document.body.appendChild(div);

    const resizeStream = onResize(div);

    const subscription = resizeStream.subscribe({
      next: ({ width, height }) => {
        expect(width).toBe(100);
        expect(height).toBe(50);
        subscription.unsubscribe();
        document.body.removeChild(div);
        done();
      }
    });

    // Trigger ResizeObserver manually
    div.style.width = '100px';
    div.style.height = '50px';
    div.dispatchEvent(new Event('resize')); // Note: may not trigger RO, so observer may need to be mocked in real test
  });

 it('should complete when element is removed from DOM', (done) => {
  const div = document.createElement('div');
  div.style.width = '100px';
  div.style.height = '100px';
  document.body.appendChild(div);

  const resizeStream = onResize(div);
  let completeCalled = false;

  const subscription = resizeStream.subscribe({
    next: () => {}, 
    complete: () => {
      completeCalled = true;
      subscription.unsubscribe();
      
      // Verify that complete was called
      expect(completeCalled).toBe(true);
      
      // Verify element is no longer in DOM
      expect(document.body.contains(div)).toBe(false);
      
      done();
    }
  });

  // Remove the element after a short delay
  setTimeout(() => {
    document.body.removeChild(div);
  }, 50);
});

// Alternative: If you want to test that complete is called without extra variable
it('should complete when element is removed from DOM', (done) => {
  const div = document.createElement('div');
  div.style.width = '100px';
  div.style.height = '100px';
  document.body.appendChild(div);

  const resizeStream = onResize(div);

  const subscription = resizeStream.subscribe({
    next: () => {}, 
    complete: () => {
      subscription.unsubscribe();
      
      // If we reach here, complete was called successfully
      expect(true).toBe(true); // Assertion to confirm complete was invoked
      
      done();
    }
  });

  // Remove the element after a short delay
  setTimeout(() => {
    document.body.removeChild(div);
  }, 50);
});

  // More robust version with timeout protection
  it('should complete when element is removed from DOM', (done) => {
    const div = document.createElement('div');
    div.style.width = '100px';
    div.style.height = '100px';
    document.body.appendChild(div);

    const resizeStream = onResize(div);
    
    // Fail test if complete doesn't happen within reasonable time
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      done.fail('Observable did not complete within expected time');
    }, 200);

    const subscription = resizeStream.subscribe({
      next: () => {}, 
      complete: () => {
        clearTimeout(timeout);
        subscription.unsubscribe();
        expect(document.body.contains(div)).toBe(false);
        done();
      }
    });

    // Remove the element after a short delay
    setTimeout(() => {
      document.body.removeChild(div);
    }, 50);
  });
});
