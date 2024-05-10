import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HardhatError, applyErrorMessageTemplate } from "../src/errors.js";
import { ERROR_CATEGORIES, ErrorDescriptor } from "../src/descriptors.js";

const mockErrorDescriptor: ErrorDescriptor = {
  number: 123,
  messageTemplate: "error message",
  websiteTitle: "Mock error",
  websiteDescription: "This is a mock error",
};

describe("HardhatError", () => {
  describe("Type guard", () => {
    it("Should return true for HardhatErrors", () => {
      assert.ok(
        HardhatError.isHardhatError(new HardhatError(mockErrorDescriptor)),
      );
    });

    it("Should return false for everything else", () => {
      assert.ok(!HardhatError.isHardhatError(new Error()));
      assert.ok(!HardhatError.isHardhatError(undefined));
      assert.ok(!HardhatError.isHardhatError(null));
      assert.ok(!HardhatError.isHardhatError(123));
      assert.ok(!HardhatError.isHardhatError("123"));
      assert.ok(!HardhatError.isHardhatError({ asd: 123 }));
    });
  });

  describe("Without parent error", () => {
    it("should have the right error number", () => {
      const error = new HardhatError(mockErrorDescriptor);
      assert.equal(error.number, mockErrorDescriptor.number);
    });

    it("should format the error code to 4 digits", () => {
      const error = new HardhatError(mockErrorDescriptor);
      assert.equal(error.message.substr(0, 8), "HHE123: ");

      assert.equal(
        new HardhatError({
          number: 1,
          messageTemplate: "",
          websiteTitle: "Title",
          websiteDescription: "Description",
        }).message.substr(0, 7),
        "HHE1: ",
      );
    });

    it("should have the right error message", () => {
      const error = new HardhatError(mockErrorDescriptor);
      assert.equal(
        error.message,
        `HHE123: ${mockErrorDescriptor.messageTemplate}`,
      );
    });

    it("should format the error message with the template params", () => {
      const error = new HardhatError(
        {
          number: 12,
          messageTemplate: "%a% %b% %c%",
          websiteTitle: "Title",
          websiteDescription: "Description",
        },
        { a: "a", b: "b", c: 123 },
      );
      assert.equal(error.message, "HHE12: a b 123");
    });

    it("shouldn't have a cause", () => {
      assert.equal(new HardhatError(mockErrorDescriptor).cause, undefined);
    });
  });

  describe("With cause error", () => {
    it("should have the right cause error", () => {
      const cause = new Error();
      const error = new HardhatError(mockErrorDescriptor, {}, cause);
      assert.equal(error.cause, cause);
    });

    it("should format the error message with the template params", () => {
      const error = new HardhatError(
        {
          number: 12,
          messageTemplate: "%a% %b% %c%",
          websiteTitle: "Title",
          websiteDescription: "Description",
        },
        { a: "a", b: "b", c: 123 },
        new Error(),
      );
      assert.equal(error.message, "HHE12: a b 123");
    });
  });
});

describe("Error categories", () => {
  it("Should have max > min", () => {
    for (const errorGroup of Object.keys(ERROR_CATEGORIES)) {
      const range = ERROR_CATEGORIES[errorGroup];
      assert.ok(range.min < range.max, `Range of ${errorGroup} is invalid`);
    }
  });

  it("Shouldn't overlap ranges", () => {
    for (const errorGroup of Object.keys(ERROR_CATEGORIES)) {
      const range = ERROR_CATEGORIES[errorGroup];

      for (const errorGroup2 of Object.keys(ERROR_CATEGORIES)) {
        const range2 = ERROR_CATEGORIES[errorGroup2];

        if (errorGroup === errorGroup2) {
          continue;
        }

        const rangesHaveOverlap =
          (range.min >= range2.min && range.min <= range2.max) ||
          (range.max >= range2.min && range.max <= range2.max);

        assert.ok(
          !rangesHaveOverlap,
          `Ranges of ${errorGroup} and ${errorGroup2} overlap`,
        );
      }
    }
  });
});

describe("Error descriptors", () => {
  it("Should have all errors inside their ranges", () => {
    for (const errorGroup of Object.keys(HardhatError.ERRORS) as Array<
      keyof typeof HardhatError.ERRORS
    >) {
      const range = ERROR_CATEGORIES[errorGroup];

      for (const [name, errorDescriptor] of Object.entries<ErrorDescriptor>(
        HardhatError.ERRORS[errorGroup],
      )) {
        assert.ok(
          errorDescriptor.number >= range.min,
          `ERRORS.${errorGroup}.${name}'s number is out of range`,
        );

        assert.ok(
          errorDescriptor.number <= range.max - 1,
          `ERRORS.${errorGroup}.${name}'s number is out of range`,
        );
      }
    }
  });

  it("Shouldn't repeat error numbers", () => {
    for (const errorGroup of Object.keys(HardhatError.ERRORS) as Array<
      keyof typeof HardhatError.ERRORS
    >) {
      for (const [name, errorDescriptor] of Object.entries<ErrorDescriptor>(
        HardhatError.ERRORS[errorGroup],
      )) {
        for (const [name2, errorDescriptor2] of Object.entries<ErrorDescriptor>(
          HardhatError.ERRORS[errorGroup],
        )) {
          if (name !== name2) {
            assert.notEqual(
              errorDescriptor.number,
              errorDescriptor2.number,
              `ERRORS.${errorGroup}.${name} and ${errorGroup}.${name2} have repeated numbers`,
            );
          }
        }
      }
    }
  });

  it("Should keep the numbers in order, without gaps", () => {
    for (const errorGroup of Object.keys(HardhatError.ERRORS) as Array<
      keyof typeof HardhatError.ERRORS
    >) {
      const range = ERROR_CATEGORIES[errorGroup];
      let expectedErrorNumber = range.min;

      for (const [name, errorDescriptor] of Object.entries<ErrorDescriptor>(
        HardhatError.ERRORS[errorGroup],
      )) {
        assert.equal(
          errorDescriptor.number,
          expectedErrorNumber,
          `ERRORS.${errorGroup}.${name}'s number is out of range`,
        );

        expectedErrorNumber += 1;
      }
    }
  });
});

describe("applyErrorMessageTemplate", () => {
  function expectHardhatError(f: () => void, errorDescriptor: ErrorDescriptor) {
    try {
      f();
      assert.fail("Expected a HardhatError and none was thrown");
    } catch (e) {
      if (HardhatError.isHardhatError(e)) {
        assert.equal(e.number, errorDescriptor.number);
      } else {
        throw e;
      }
    }
  }

  describe("Variable names", () => {
    it("Should reject invalid variable names", () => {
      expectHardhatError(
        () => applyErrorMessageTemplate("", { "1": 1 }),
        HardhatError.ERRORS.INTERNAL.ASSERTION_ERROR,
      );

      expectHardhatError(
        () => applyErrorMessageTemplate("", { "asd%": 1 }),
        HardhatError.ERRORS.INTERNAL.ASSERTION_ERROR,
      );

      expectHardhatError(
        () => applyErrorMessageTemplate("", { "asd asd": 1 }),
        HardhatError.ERRORS.INTERNAL.ASSERTION_ERROR,
      );
    });
  });

  describe("Values", () => {
    it("shouldn't contain valid variable tags", () => {
      expectHardhatError(
        () => applyErrorMessageTemplate("%asd%", { asd: "%as%" }),
        HardhatError.ERRORS.INTERNAL.ASSERTION_ERROR,
      );

      expectHardhatError(
        () => applyErrorMessageTemplate("%asd%", { asd: "%a123%" }),
        HardhatError.ERRORS.INTERNAL.ASSERTION_ERROR,
      );

      expectHardhatError(
        () =>
          applyErrorMessageTemplate("%asd%", {
            asd: { toString: () => "%asd%" },
          }),
        HardhatError.ERRORS.INTERNAL.ASSERTION_ERROR,
      );
    });

    it("Shouldn't contain the %% tag", () => {
      expectHardhatError(
        () => applyErrorMessageTemplate("%asd%", { asd: "%%" }),
        HardhatError.ERRORS.INTERNAL.ASSERTION_ERROR,
      );
    });
  });

  describe("Replacements", () => {
    describe("String values", () => {
      it("Should replace variable tags for the values", () => {
        assert.equal(
          applyErrorMessageTemplate("asd %asd% 123 %asd%", { asd: "r" }),
          "asd r 123 r",
        );

        assert.equal(
          applyErrorMessageTemplate("asd%asd% %asd% %fgh% 123", {
            asd: "r",
            fgh: "b",
          }),
          "asdr r b 123",
        );

        assert.equal(
          applyErrorMessageTemplate("asd%asd% %asd% %fgh% 123", {
            asd: "r",
            fgh: "",
          }),
          "asdr r  123",
        );
      });
    });

    describe("Non-string values", () => {
      it("Should replace undefined values for undefined", () => {
        assert.equal(
          applyErrorMessageTemplate("asd %asd% 123 %asd%", { asd: undefined }),
          "asd undefined 123 undefined",
        );
      });

      it("Should replace null values for null", () => {
        assert.equal(
          applyErrorMessageTemplate("asd %asd% 123 %asd%", { asd: null }),
          "asd null 123 null",
        );
      });

      it("Should use their toString methods", () => {
        const toR = { toString: () => "r" };
        const toB = { toString: () => "b" };
        const toEmpty = { toString: () => "" };

        assert.equal(
          applyErrorMessageTemplate("asd %asd% 123 %asd%", { asd: toR }),
          "asd r 123 r",
        );

        assert.equal(
          applyErrorMessageTemplate("asd%asd% %asd% %fgh% 123", {
            asd: toR,
            fgh: toB,
          }),
          "asdr r b 123",
        );

        assert.equal(
          applyErrorMessageTemplate("asd%asd% %asd% %fgh% 123", {
            asd: toR,
            fgh: toEmpty,
          }),
          "asdr r  123",
        );
      });
    });

    describe("%% sign", () => {
      it("Should be replaced with %", () => {
        assert.equal(applyErrorMessageTemplate("asd%%asd", {}), "asd%asd");
      });

      it("Shouldn't apply replacements if after this one a new variable tag appears", () => {
        assert.equal(
          applyErrorMessageTemplate("asd%%asd%% %asd%", { asd: "123" }),
          "asd%asd% 123",
        );
      });
    });

    describe("Missing variable tag", () => {
      it("Should fail if a viable tag is missing and its value is not", () => {
        expectHardhatError(
          () => applyErrorMessageTemplate("", { asd: "123" }),
          HardhatError.ERRORS.INTERNAL.ASSERTION_ERROR,
        );
      });
    });

    describe("Missing variable", () => {
      it("Should work, leaving the variable tag", () => {
        assert.equal(
          applyErrorMessageTemplate("%asd% %fgh%", { asd: "123" }),
          "123 %fgh%",
        );
      });
    });
  });
});
