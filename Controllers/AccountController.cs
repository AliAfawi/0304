using BookShop.Models;
using BookShop.ViewModels;
using BookStore.Data;
using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.AspNet.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;


namespace BookShop.Controllers
{
    public class AccountController : Controller
    {
        private readonly SignInManager<User> signInManager;
        private readonly Microsoft.AspNetCore.Identity.UserManager<User> userManager;
        private readonly BookStoreContext _context;
        public AccountController(SignInManager<User> signInManager, Microsoft.AspNetCore.Identity.UserManager<User> userManager, BookStoreContext context)
        {
            this.signInManager = signInManager;
            this.userManager = userManager;
            this._context = context;
        }


        public IActionResult login()
        {
            return View();
        }



        [HttpPost]
        public async Task<IActionResult> login(LoginVM model)
        {
            if (ModelState.IsValid)
            {
                var user = await userManager.FindByNameAsync(model.UserName);
                if (user != null)
                {
                    // Ensure you await the task here
                    var result = await signInManager.CheckPasswordSignInAsync(user, model.Password, false);
                    if (result.Succeeded) // Now you are accessing SignInResult's Succeeded property
                    {
                        await signInManager.SignInAsync(user, false);
                        HttpContext.Session.SetString("CartId", user.Id.ToString());
                        return RedirectToAction("Index", "Home");
                    }
                    else
                    {
                        ModelState.AddModelError("", "Invalid login attempt!");
                        return View(model);
                    }
                }
                else
                {
                    ModelState.AddModelError("", "User not found.");
                    return View(model);
                }
            }
            return View(model);
        }

        public async Task<IActionResult> Register(RegisterVM model)
        {
            if (ModelState.IsValid)
            {
                User user = new User
                {
                    UserName = model.UserName, // This sets the inherited UserName property
                    Email = model.Email,
                    EmailConfirmed = true,
                    LockoutEnabled = true,
                    PhoneNumberConfirmed = true,
                    TwoFactorEnabled = true
                };

                var result = await userManager.CreateAsync(user, model.Password);

                if (result.Succeeded)
                {
                    await signInManager.SignInAsync(user, false);
                    return RedirectToAction("Index", "Home");
                }
                foreach (var error in result.Errors)
                {
                    ModelState.AddModelError("", error.Description);
                }
            }

            return View(model);
        }

        public async Task<IActionResult> Logout()
        {
            await signInManager.SignOutAsync();
            return RedirectToAction("Index", "Home");
        }

        public async Task<IActionResult> Reset(ResetVM model)
        {
            if (ModelState.IsValid)
            {
                var user = await userManager.FindByEmailAsync(model.Email);
                if (user == null)
                {
                    ModelState.AddModelError("", "Invalid reset attempt!");
                    return View(model);
                }

                var result = await userManager.ResetPasswordAsync(user, model.OldPassword!, model.NewPassword!);
                if (result.Succeeded)
                {
                    return RedirectToAction("login", "Account");
                }

                foreach (var error in result.Errors)
                {
                    ModelState.AddModelError(string.Empty, error.Description);
                }
                return View();
            }
            return View();
        }
    }
}
